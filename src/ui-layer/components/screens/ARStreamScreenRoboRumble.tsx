import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import AgoraRTC, { ILocalVideoTrack, IMicrophoneAudioTrack, IAgoraRTCClient } from 'agora-rtc-sdk-ng';
import { Button } from '../shared/Button';
import { RaceSession } from '../../../shared/types/race';
import { APP_ID, fetchToken } from '../../../shared/utils/agoraAuth';
import { EnhancedARDetector, DetectedMarker } from '../../../engine-layer/core/ar/EnhancedARDetector';
import { GameRenderSystem } from '../../../engine-layer/core/renderer/GameRenderSystem';
import { GamePhysicsSystem } from '../../../engine-layer/core/physics/GamePhysicsSystem';
import { InputController } from '../../../engine-layer/core/input/InputController';
import { GameLoop } from '../../../engine-layer/core/game/GameLoop';
import { GameState, KeyState } from '../../../shared/types/GameTypes';
import SuiWalletConnect from '../shared/SuiWalletConnect';

interface ARStreamScreenRoboRumbleProps {
  session: RaceSession;
  onBack: () => void;
}

interface DeliveryPoint {
  row: number;
  col: number;
  id: string;
}

interface Robot {
  id: string;
  name: string;
  position: { x: number; y: number };
  status: 'idle' | 'moving' | 'delivering' | 'offline';
  battery: number;
}

interface RemoteUser {
  uid: number;
  role: 'audience';
  joinTime: number;
  hasVideo?: boolean;
  hasAudio?: boolean;
  videoTrack?: any;
  audioTrack?: any;
}

export const ARStreamScreenRoboRumble: React.FC<ARStreamScreenRoboRumbleProps> = ({ session, onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // AR System refs - for camera + overlay (like viewer experience)
  const arDetectorRef = useRef<EnhancedARDetector | null>(null);
  const renderSystemRef = useRef<GameRenderSystem | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // 3D Game System refs - for full game mode  
  const physicsSystemRef = useRef<GamePhysicsSystem | null>(null);
  const inputControllerRef = useRef<InputController | null>(null);
  const gameLoopRef = useRef<GameLoop | null>(null);
  
  // Agora refs
  const rtcClientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<ILocalVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  
  // Game state for 3D mode
  const [gameState, setGameState] = useState<GameState>({
    position: new THREE.Vector3(0, 1, 0),
    rotation: 0,
    velocity: new THREE.Vector2(0, 0),
    isColliding: false
  });
  
  // Input state for 3D mode
  const [keys, setKeys] = useState<KeyState>({
    forward: false,
    backward: false,
    left: false,
    right: false
  });
  
  // AR mode state - default to true for camera + overlay experience
  const [arMode, setArMode] = useState(true);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [detectedMarkers, setDetectedMarkers] = useState<DetectedMarker[]>([]);
  const [arEffectsEnabled, setArEffectsEnabled] = useState(true);
  
  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const [localUid, setLocalUid] = useState<number | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<Map<number, RemoteUser>>(new Map());
  
  // Robotics control state
  const [startPoint, setStartPoint] = useState<DeliveryPoint | null>(null);
  const [endPoint, setEndPoint] = useState<DeliveryPoint | null>(null);
  const [robots, setRobots] = useState<Robot[]>([
    { id: 'robot-a', name: 'Robot A', position: { x: 10, y: 10 }, status: 'idle', battery: 85 },
    { id: 'robot-b', name: 'Robot B', position: { x: 80, y: 60 }, status: 'idle', battery: 92 }
  ]);
  const [deliveryStatus, setDeliveryStatus] = useState<string>('waiting');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'confirmed' | 'failed'>('pending');
  const [deliveryCost] = useState(0.5);
  
  // Chat system state
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    timestamp: string;
    sender: string;
    senderUid: number;
    message: string;
    isHost: boolean;
  }>>([]);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // AR effects toggle handler
  const toggleAREffects = () => {
    const newEnabled = !arEffectsEnabled;
    setArEffectsEnabled(newEnabled);
    
    if (renderSystemRef.current) {
      renderSystemRef.current.setAREffectsEnabled(newEnabled);
      
      // If enabling AR effects in AR mode, update with current markers
      if (newEnabled && arMode && detectedMarkers.length > 0) {
        renderSystemRef.current.updateAREffects(detectedMarkers);
      }
    }
  };
  
  // AR mode toggle handler
  const toggleARMode = async () => {
    if (!arMode) {
      // Switching TO AR mode (camera + overlay) - cleanup 3D game first
      console.log('Switching to AR mode...');
      
      // Stop 3D game systems
      if (gameLoopRef.current) {
        gameLoopRef.current.dispose();
        gameLoopRef.current = null;
      }
      if (inputControllerRef.current) {
        inputControllerRef.current.dispose();
        inputControllerRef.current = null;
      }
      if (physicsSystemRef.current) {
        physicsSystemRef.current.dispose();
        physicsSystemRef.current = null;
      }
      
      // Start webcam for AR
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        setWebcamStream(stream);
        setWebcamError(null);
        
        // Set up video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          const onVideoLoaded = async () => {
            console.log('Webcam video loaded, video dimensions:', 
              videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
            
            // Ensure video is playing before starting AR
            if (videoRef.current) {
              try {
                await videoRef.current.play();
                console.log('Video is now playing, starting AR initialization...');
              } catch (error) {
                console.log('Video play() returned promise, likely already playing');
              }
              
              // Set AR mode to true now that video is ready
              setArMode(true);
              
              // Wait a bit more to ensure video is fully ready
              setTimeout(() => {
                initializeARSystem();
              }, 500);
            }
            
            videoRef.current?.removeEventListener('loadeddata', onVideoLoaded);
          };
          
          const onVideoError = (error: any) => {
            console.error('Video element error:', error);
            setWebcamError('Failed to load video stream');
          };
          
          videoRef.current.addEventListener('loadeddata', onVideoLoaded);
          videoRef.current.addEventListener('error', onVideoError);
          
          // Also listen for when video starts playing
          const onVideoPlay = () => {
            console.log('Video started playing');
          };
          videoRef.current.addEventListener('play', onVideoPlay);
        }
      } catch (error) {
        console.error('Failed to access webcam:', error);
        setWebcamError(`Failed to access camera: ${error instanceof Error ? error.message : String(error)}`);
        setArMode(false);
      }
    } else {
      // Switching TO 3D mode - cleanup AR first
      console.log('Switching to 3D mode...');
      
      // Stop AR systems
      cleanupARSystem();
      
      // Stop webcam
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        setWebcamStream(null);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setArMode(false);
      setWebcamError(null);
      
      // Initialize 3D game systems
      setTimeout(() => {
        initializeGameSystems();
      }, 100);
    }
  };
  
  // Initialize AR overlay system (camera + AR overlay like viewer)
  const initializeARSystem = async () => {
    if (!canvasRef.current) return;
    
    try {
      console.log('Initializing AR overlay system for Robo Rumble host...');
      
      // Ensure canvas matches its container size
      const container = canvasRef.current.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
        console.log(`Canvas sized to container: ${rect.width}x${rect.height}`);
      }
      
      // Create render system for AR overlay
      const renderSystem = new GameRenderSystem();
      renderSystemRef.current = renderSystem;
      
      // Initialize with transparent background for overlay
      renderSystem.initialize(canvasRef.current);
      renderSystem.setARMode(true); // Enable transparent rendering
      
      // Enable AR effects by default
      renderSystem.setAREffectsEnabled(arEffectsEnabled);
      
      // Create AR detector
      const arDetector = new EnhancedARDetector((message) => {
        console.log(`[AR Robo Rumble Host] ${message}`);
      });
      arDetectorRef.current = arDetector;
      
      // Get scene and camera from render system
      const scene = renderSystem.getScene();
      const camera = renderSystem.getCamera();
      
      // Initialize AR detector
      await arDetector.initialize(scene || undefined, camera || undefined);
      
      // Start AR rendering loop
      startARRenderingLoop();
      
      console.log('AR overlay system initialized for Robo Rumble host');
    } catch (error) {
      console.error('Failed to initialize AR system:', error);
    }
  };

  // AR rendering loop (camera + overlay)
  const startARRenderingLoop = () => {
    if (!arDetectorRef.current || !renderSystemRef.current) return;
    
    let frameCount = 0;
    
    const renderLoop = () => {
      frameCount++;
      
      // Run AR detection on RoboRumble demo video
      if (videoRef.current && arDetectorRef.current) {
        // Check video readiness - only detect if video is properly loaded
        const video = videoRef.current;
        
        // Check video readiness every 60 frames (roughly once per second at 60fps)
        if (frameCount % 60 === 0) {
          console.log(`AR Detection Status - Video ready: ${video.videoWidth}x${video.videoHeight}, Current time: ${video.currentTime}, Paused: ${video.paused}, ReadyState: ${video.readyState}`);
        }
        
        // Only attempt detection if video has valid dimensions and is playing
        if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
          const markers = arDetectorRef.current.detectMarkers(video);
          
          if (markers.length > 0 && frameCount % 60 === 0) {
            console.log(`[AR Robo Rumble Host] Detected ${markers.length} markers`);
          }
          
          setDetectedMarkers(markers);
          
          // Update AR markers in the scene
          if (renderSystemRef.current) {
            renderSystemRef.current.updateAREffects(markers);
            renderSystemRef.current.setAREffectsEnabled(arEffectsEnabled);
            renderSystemRef.current.render();
          }
        } else if (frameCount % 60 === 0) {
          console.log(`[AR Robo Rumble Host] Video not ready for detection - waiting...`);
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };
    
    animationFrameRef.current = requestAnimationFrame(renderLoop);
  };

  // Cleanup AR system
  const cleanupARSystem = () => {
    console.log('Cleaning up AR system...');
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (renderSystemRef.current) {
      renderSystemRef.current.dispose();
      renderSystemRef.current = null;
    }
    
    if (arDetectorRef.current) {
      arDetectorRef.current.dispose();
      arDetectorRef.current = null;
    }
    
    setDetectedMarkers([]);
  };

  // Initialize full 3D game systems
  const initializeGameSystems = async () => {
    if (!canvasRef.current) return;
    
    try {
      console.log('Initializing 3D game systems...');
      
      // Create systems
      const physicsSystem = new GamePhysicsSystem();
      const renderSystem = new GameRenderSystem();
      const inputController = new InputController();
      
      // Store refs
      physicsSystemRef.current = physicsSystem;
      renderSystemRef.current = renderSystem;
      inputControllerRef.current = inputController;
      
      // Initialize physics
      await physicsSystem.initialize();
      
      // Initialize renderer in 3D mode
      renderSystem.initialize(canvasRef.current);
      renderSystem.setARMode(false); // Disable AR mode for full 3D
      
      // Initialize input controller
      inputController.initialize(canvasRef.current, setKeys);
      
      // Create and start game loop
      const gameLoop = new GameLoop(physicsSystem, renderSystem, inputController);
      gameLoopRef.current = gameLoop;
      gameLoop.start(setGameState);
      
      console.log('3D game systems initialized');
    } catch (error) {
      console.error('Error initializing 3D game systems:', error);
    }
  };

  // Initialize webcam and AR on component mount
  useEffect(() => {
    const initializeWebcamAndAR = async () => {
      try {
        console.log('Requesting webcam access...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        
        console.log('Webcam access granted');
        setWebcamStream(stream);
        setWebcamError(null);
        
        // Set up video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          const onVideoLoaded = async () => {
            console.log('Webcam video loaded, video dimensions:', 
              videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
            
            // Ensure video is playing before starting AR
            if (videoRef.current) {
              try {
                await videoRef.current.play();
                console.log('Webcam video is now playing, starting AR initialization...');
              } catch (error) {
                console.log('Video play() returned promise, likely already playing');
              }
              
              // Wait a bit more to ensure video is fully ready
              setTimeout(() => {
                initializeARSystem();
              }, 500);
            }
            
            videoRef.current?.removeEventListener('loadeddata', onVideoLoaded);
          };
          
          const onVideoError = (error: any) => {
            console.error('Video element error:', error);
            setWebcamError('Failed to load video stream');
          };
          
          videoRef.current.addEventListener('loadeddata', onVideoLoaded);
          videoRef.current.addEventListener('error', onVideoError);
          
          // Also listen for when video starts playing
          const onVideoPlay = () => {
            console.log('Webcam video started playing');
          };
          videoRef.current.addEventListener('play', onVideoPlay);
        }
      } catch (error) {
        console.error('Failed to access webcam:', error);
        setWebcamError(`Failed to access camera: ${error instanceof Error ? error.message : String(error)}`);
        setArMode(false);
        
        console.log('❌ Webcam access failed, AR features will be disabled');
      }
    };

    initializeWebcamAndAR();

    // Set up resize observer for canvas sizing
    let resizeObserver: ResizeObserver | null = null;
    
    if (canvasRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (canvasRef.current) {
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            console.log(`Canvas resized to: ${width}x${height}`);
            
            // Update render system if it exists
            if (renderSystemRef.current) {
              renderSystemRef.current.resize();
            }
          }
        }
      });
      
      resizeObserver.observe(canvasRef.current.parentElement || canvasRef.current);
    }

    return () => {
      console.log('Component cleanup...');
      
      // Cleanup resize observer
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      
      // Cleanup AR systems
      cleanupARSystem();
      
      // Cleanup 3D game systems
      if (gameLoopRef.current) {
        gameLoopRef.current.dispose();
        gameLoopRef.current = null;
      }
      if (inputControllerRef.current) {
        inputControllerRef.current.dispose();
        inputControllerRef.current = null;
      }
      if (physicsSystemRef.current) {
        physicsSystemRef.current.dispose();
        physicsSystemRef.current = null;
      }
      
      // Stop webcam
      if (webcamStream) {
        console.log('Stopping webcam tracks');
        webcamStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Empty dependency array to run only once

  // Robotics control functions
  const handleGridClick = (row: number, col: number) => {
    if (!startPoint) {
      setStartPoint({ row, col, id: 'start' });
      setDeliveryStatus('Select target point');
    } else if (!endPoint) {
      setEndPoint({ row, col, id: 'end' });
      setDeliveryStatus('Ready to engage battle');
    } else {
      // Reset selection
      setStartPoint({ row, col, id: 'start' });
      setEndPoint(null);
      setDeliveryStatus('Select target point');
    }
  };

  // Add periodic debug logging for streaming state
  useEffect(() => {
    if (!isStreaming) return;
    
    const debugInterval = setInterval(() => {
      console.log(`🔍 ROBO RUMBLE HOST DEBUG CHECK:`);
      console.log(`  - Local UID: ${localUid}`);
      console.log(`  - Viewers: ${remoteUsers.size}`, Array.from(remoteUsers.keys()));
      console.log(`  - Agora client state:`, rtcClientRef.current?.connectionState);
      console.log(`  - Channel: ${session.id}`);
    }, 10000); // Every 10 seconds
    
    return () => clearInterval(debugInterval);
  }, [isStreaming, localUid, remoteUsers, session.id]);

  const executeDelivery = async () => {
    if (!startPoint || !endPoint) return;
    
    setPaymentStatus('processing');
    setDeliveryStatus('Initiating battle sequence...');
    
    // Simulate battle processing
    setTimeout(() => {
      setPaymentStatus('confirmed');
      setDeliveryStatus('Battle confirmed! Robots engaging...');
      
      // Simulate robot battle
      setTimeout(() => {
        setDeliveryStatus('Robot A selected for battle');
        setRobots(prev => prev.map(robot => 
          robot.id === 'robot-a' 
            ? { ...robot, status: 'moving' }
            : robot
        ));
        
        // Simulate battle progress
        setTimeout(() => {
          setDeliveryStatus('Battle in progress...');
        }, 2000);
      }, 3000);
    }, 2000);
  };

  const resetDelivery = () => {
    setStartPoint(null);
    setEndPoint(null);
    setPaymentStatus('pending');
    setDeliveryStatus('waiting');
    setRobots(prev => prev.map(robot => ({ ...robot, status: 'idle' })));
  };

  // Start streaming
  const startStreaming = async () => {
    try {
      setStreamingError(null);
      console.log('Starting Robo Rumble stream...');
      
      // Create Agora client
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
      rtcClientRef.current = client;
      
      // Set up client events to detect viewers joining/leaving
      client.on('user-joined', (user) => {
        console.log(`🟢 Viewer ${user.uid} joined the Robo Rumble stream`);
        
        // Add viewer to remoteUsers
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          newMap.set(user.uid as number, { 
            uid: user.uid as number, 
            role: 'audience',
            joinTime: Date.now()
          });
          console.log(`📊 Viewers count updated: ${newMap.size} viewers`);
          return newMap;
        });
      });
      
      client.on('user-published', async (user, mediaType) => {
        console.log(`📺 User ${user.uid} published ${mediaType}`);
        
        // Subscribe to the viewer's media to receive proper events
        try {
          await client.subscribe(user, mediaType);
          console.log(`✅ Host subscribed to ${mediaType} from viewer ${user.uid}`);
        } catch (error) {
          console.error(`❌ Failed to subscribe to ${mediaType} from viewer ${user.uid}:`, error);
        }
        
        // Update viewer media status
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          const existingUser = newMap.get(user.uid as number) || { 
            uid: user.uid as number, 
            role: 'audience',
            joinTime: Date.now(),
            hasVideo: false,
            hasAudio: false
          };
          
          if (mediaType === 'video') {
            existingUser.hasVideo = true;
            existingUser.videoTrack = user.videoTrack;
            console.log(`🎥 Viewer ${user.uid} camera is now ON`);
          } else if (mediaType === 'audio') {
            existingUser.hasAudio = true;
            existingUser.audioTrack = user.audioTrack;
            // Play audio for the host to hear
            if (user.audioTrack) {
              user.audioTrack.play();
            }
            console.log(`🎤 Viewer ${user.uid} microphone is now ON`);
          }
          
          newMap.set(user.uid as number, existingUser);
          return newMap;
        });
      });
      
      client.on('user-unpublished', (user, mediaType) => {
        console.log(`🔇 User ${user.uid} unpublished ${mediaType}`);
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          const existingUser = newMap.get(user.uid as number);
          if (existingUser) {
            if (mediaType === 'video') {
              existingUser.hasVideo = false;
              existingUser.videoTrack = null;
              console.log(`🎥❌ Viewer ${user.uid} camera is now OFF`);
            } else if (mediaType === 'audio') {
              existingUser.hasAudio = false;
              existingUser.audioTrack = null;
              console.log(`🎤❌ Viewer ${user.uid} microphone is now OFF`);
            }
            newMap.set(user.uid as number, existingUser);
          }
          return newMap;
        });
      });
      
      client.on('user-left', (user) => {
        console.log(`🔴 Viewer ${user.uid} left the Robo Rumble stream`);
        
        // Remove viewer from remoteUsers
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(user.uid as number);
          console.log(`📊 Viewers count updated: ${newMap.size} viewers`);
          return newMap;
        });
      });
      
      // Set client role to host
      await client.setClientRole('host');
      
      // Generate UID
      const uid = Math.floor(Math.random() * 100000);
      setLocalUid(uid);
      
      // Join channel
      const token = await fetchToken(session.id, uid, 'host');
      await client.join(APP_ID, session.id, token, uid);
      console.log(`Joined channel ${session.id} with UID ${uid} as Robo Rumble host`);
      
      // Create video track from webcam
      try {
        console.log('🎬 Creating video track for streaming...');
        
        if (!webcamStream || webcamStream.getVideoTracks().length === 0) {
          throw new Error('No webcam stream available for streaming');
        }
        
        console.log('📹 Using webcam for streaming');
        
        const videoTrack = await AgoraRTC.createCustomVideoTrack({
          mediaStreamTrack: webcamStream.getVideoTracks()[0],
        });
        
        console.log('✅ Agora video track created from webcam successfully');
        
        // Create audio track from microphone for host commentary
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        console.log('🎤 Audio track created successfully');
        
        localVideoTrackRef.current = videoTrack;
        localAudioTrackRef.current = audioTrack;
        
        // Publish tracks
        console.log('📤 Publishing webcam video and audio tracks...');
        await client.publish([videoTrack, audioTrack]);
        console.log('✅ Published webcam stream successfully');
        
        setIsStreaming(true);
        
        // Add periodic logging to monitor stream health
        const streamMonitor = setInterval(() => {
          console.log(`🔍 ROBO RUMBLE HOST STREAM CHECK:`);
          console.log(`  - Local UID: ${uid}`);
          console.log(`  - Viewers: ${remoteUsers.size}`, Array.from(remoteUsers.keys()));
          console.log(`  - Agora client state:`, client.connectionState);
          console.log(`  - Channel: ${session.id}`);
        }, 10000); // Every 10 seconds
        
        // Store interval ID for cleanup
        (client as any)._streamMonitor = streamMonitor;
        
      } catch (videoError) {
        console.error('❌ Failed to create video track for streaming:', videoError);
        setStreamingError(`Failed to start stream: ${videoError instanceof Error ? videoError.message : String(videoError)}`);
      }
    } catch (error) {
      console.error('Error starting stream:', error);
      setStreamingError(`Failed to start stream: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Stop streaming
  const stopStreaming = async () => {
    try {
      if (rtcClientRef.current) {
        if (localVideoTrackRef.current && localAudioTrackRef.current) {
          await rtcClientRef.current.unpublish([localVideoTrackRef.current, localAudioTrackRef.current]);
        }
        
        localVideoTrackRef.current?.close();
        localAudioTrackRef.current?.close();
        
        await rtcClientRef.current.leave();
        
        rtcClientRef.current = null;
        localVideoTrackRef.current = null;
        localAudioTrackRef.current = null;
      }
      
      setIsStreaming(false);
      setLocalUid(null);
      setRemoteUsers(new Map());
      console.log('Stopped Robo Rumble streaming');
    } catch (error) {
      console.error('Error stopping stream:', error);
    }
  };
  
  // Send chat message to all viewers
  const sendChatMessage = async () => {
    if (!currentMessage.trim() || isSendingMessage || !isStreaming || !localUid) return;
    
    setIsSendingMessage(true);
    
    try {
      const timestamp = new Date().toLocaleTimeString();
      const messageId = `msg-${Date.now()}`;
      
      // Add message to local chat immediately
      const newMessage = {
        id: messageId,
        timestamp,
        sender: 'Host',
        senderUid: localUid,
        message: currentMessage.trim(),
        isHost: true
      };
      
      setChatMessages(prev => [newMessage, ...prev].slice(0, 100)); // Keep last 100 messages
      
      // Send message to viewers via Agora data channel (simulate for now)
      // In a real implementation, you would use Agora's data stream or a separate messaging service
      console.log(`📤 Host sent message: "${currentMessage}" to ${remoteUsers.size} viewers`);
      
      // Clear input
      setCurrentMessage('');
      
    } catch (error) {
      console.error('Failed to send chat message:', error);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Handle Enter key press in chat input
  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  // Simulate receiving messages from viewers (in real app, this would come from Agora data stream)
  useEffect(() => {
    if (!isStreaming) return;
    
    const simulateViewerMessages = () => {
      const viewerMessages = [
        "Great battle setup!",
        "When does the battle start?",
        "Robot A looks strong 💪",
        "Can we see the arena closer?",
        "This is so cool!",
        "How do the robots work?",
        "Amazing AR effects! ✨",
        "Robot B has better position",
        "Let's go Robot A! 🤖"
      ];
      
      const viewerNames = ["Viewer42", "BattleFan", "RoboWatcher", "TechLover", "GameMaster"];
      
      if (remoteUsers.size > 0) {
        const randomMessage = viewerMessages[Math.floor(Math.random() * viewerMessages.length)];
        const randomName = viewerNames[Math.floor(Math.random() * viewerNames.length)];
        const randomUid = Array.from(remoteUsers.keys())[Math.floor(Math.random() * remoteUsers.size)] || 12345;
        
        const timestamp = new Date().toLocaleTimeString();
        const messageId = `viewer-msg-${Date.now()}`;
        
        const viewerMessage = {
          id: messageId,
          timestamp,
          sender: randomName,
          senderUid: randomUid,
          message: randomMessage,
          isHost: false
        };
        
        setChatMessages(prev => [viewerMessage, ...prev].slice(0, 100));
        console.log(`📥 Received viewer message from ${randomName}: "${randomMessage}"`);
      }
    };
    
    // Start simulating viewer messages after 10 seconds, then every 8-15 seconds
    const initialTimer = setTimeout(() => {
      simulateViewerMessages();
      const interval = setInterval(() => {
        if (Math.random() > 0.3) { // 70% chance to send a message
          simulateViewerMessages();
        }
      }, 8000 + Math.random() * 7000); // 8-15 seconds
      
      return () => clearInterval(interval);
    }, 10000);
    
    return () => clearTimeout(initialTimer);
  }, [isStreaming, remoteUsers.size]);

  return (
    <div className="w-full h-screen bg-[#0B0B1A] relative overflow-hidden flex flex-col">
      {/* Main Content Area - Explicitly sized to exclude bottom panel */}
      <div className="flex" style={{ height: 'calc(100vh - 6rem)' }}>
        {/* Left Side: Camera + AR Overlay */}
        <div className="flex-1 relative flex flex-col">
          {/* Header */}
          <div className="relative z-30 bg-gradient-to-r from-game-900/50 via-game-800/50 to-game-900/50 backdrop-blur-sm border-b border-white/5 p-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={onBack}
                  className="!bg-white/5 hover:!bg-white/10"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-white">{session.trackName}</h1>
                  <p className="text-sm text-white/70">Robo Rumble Arena</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* AR Mode Toggle */}
                <Button
                  variant="secondary"
                  size="small"
                  onClick={toggleARMode}
                  className={`${arMode ? '!bg-green-600 hover:!bg-green-700' : '!bg-purple-600 hover:!bg-purple-700'}`}
                >
                  {arMode ? 'AR Mode' : '3D Mode'}
                </Button>
                
                {/* Streaming Status */}
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isStreaming ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
                  <span className="text-white/90 text-sm">
                    {isStreaming ? 'Live' : 'Offline'}
                  </span>
                </div>
                
                {/* Streaming Controls */}
                {!isStreaming ? (
                  <Button
                    variant="primary"
                    size="small"
                    onClick={startStreaming}
                    disabled={!!streamingError}
                  >
                    Start Stream
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={stopStreaming}
                    className="!bg-red-600 hover:!bg-red-700"
                  >
                    Stop Stream
                  </Button>
                )}
                
                {/* Wallet Connect */}
                <div className="ml-2">
                  <SuiWalletConnect />
                </div>
              </div>
            </div>
            
            {/* Error Messages */}
            {(streamingError || webcamError) && (
              <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
                {streamingError || webcamError}
              </div>
            )}
          </div>

          {/* Main Camera + AR View - Takes remaining space */}
          <div className="flex-1 relative min-h-0 overflow-hidden">
            {/* Webcam Video Background - show when robo rumble video is not available */}
            <video 
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{ 
                transform: 'scaleX(-1)', // Mirror the video
                zIndex: 1,
                display: (!webcamStream) ? 'block' : 'none'
              }}
              autoPlay
              playsInline
              muted
            />
            
            {/* Debug overlay to show loading status */}
            {!webcamStream && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
                <div className="text-white text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p>Loading video source...</p>
                </div>
              </div>
            )}
            
            {/* Show error if both video sources fail */}
            {!webcamStream && webcamError && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 z-10">
                <div className="text-red-400 text-center p-4">
                  <p className="font-semibold mb-2">Video Source Error</p>
                  <p className="text-sm">Failed to load demo video and camera</p>
                </div>
              </div>
            )}
            
            {/* Canvas for both AR overlay and 3D rendering - Constrained to video area */}
            <canvas 
              ref={canvasRef} 
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{
                zIndex: 2,
                background: arMode ? 'transparent' : '#0B0B1A',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            />
            
            {/* Stream Info Overlay */}
            {isStreaming && (
              <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Broadcasting Robo Rumble</span>
                </div>
                <div className="text-xs text-white/70">
                  Channel: {session.id}<br />
                  UID: {localUid}<br />
                  Viewers: {remoteUsers.size}<br />
                  AR Markers: {detectedMarkers.length}<br />
                  Video Size: {videoRef.current?.videoWidth}x{videoRef.current?.videoHeight}
                </div>
              </div>
            )}
            
            {/* Debug info when not streaming */}
            {!isStreaming && (
              <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white">
                <div className="text-sm font-medium mb-1">Robo Rumble Debug Info</div>
                <div className="text-xs text-white/70">
                  Mode: {arMode ? 'AR (Camera + Overlay)' : '3D (Full Game)'}<br />
                  3D Game: {!arMode && gameLoopRef.current ? 'Running' : 'Not Active'}<br />
                  Video Size: {videoRef.current?.videoWidth}x{videoRef.current?.videoHeight}<br />
                  AR Markers: {detectedMarkers.length}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Battle Control Panel */}
        <div className="w-96 bg-gray-900 text-white border-l border-white/10 flex flex-col overflow-hidden">
          {/* Chat Header - Fixed */}
          <div className="flex-shrink-0 p-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-white mb-1">Battle Chat</h2>
            <p className="text-sm text-white/70">Communicate with viewers during the battle</p>
            {isStreaming && (
              <div className="mt-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-400">{remoteUsers.size} viewers online</span>
              </div>
            )}
          </div>
          
          {/* Chat Messages - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center text-white/50 text-sm py-8">
                  {isStreaming ? 'Chat is ready! Start the conversation...' : 'Start streaming to enable chat'}
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className={`
                    flex flex-col gap-1 p-3 rounded-lg
                    ${msg.isHost 
                      ? 'bg-blue-600/20 border-l-4 border-blue-400 ml-4' 
                      : 'bg-gray-800/50 border-l-4 border-purple-400 mr-4'
                    }
                  `}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${
                          msg.isHost ? 'text-blue-400' : 'text-purple-400'
                        }`}>
                          {msg.sender}
                        </span>
                        {msg.isHost && (
                          <span className="text-xs bg-blue-600 text-white px-1 py-0.5 rounded">
                            HOST
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-white/50">{msg.timestamp}</span>
                    </div>
                    <div className="text-sm text-white break-words">
                      {msg.message}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* Chat Input - Fixed at bottom */}
          <div className="flex-shrink-0 p-4 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleChatKeyPress}
                placeholder={isStreaming ? "Type a message..." : "Start streaming to chat"}
                disabled={!isStreaming || isSendingMessage}
                className="flex-1 bg-gray-800 border border-white/20 rounded px-3 py-2 text-white text-sm
                          placeholder-white/50 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400
                          disabled:opacity-50 disabled:cursor-not-allowed"
                maxLength={200}
              />
              <button
                onClick={sendChatMessage}
                disabled={!isStreaming || !currentMessage.trim() || isSendingMessage}
                className={`
                  px-4 py-2 rounded text-sm font-medium transition-all duration-150
                  ${(!isStreaming || !currentMessage.trim() || isSendingMessage)
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                  }
                `}
              >
                {isSendingMessage ? (
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Chat Status */}
            <div className="mt-2 text-xs text-white/50">
              {isStreaming ? (
                <>
                  Press Enter to send • {currentMessage.length}/200 characters
                </>
              ) : (
                'Start streaming to enable chat'
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Viewer Strip - Fixed Height, Always Present */}
      <div className="h-24 bg-gray-900/90 backdrop-blur-sm border-t border-white/10 flex items-center px-4 flex-shrink-0">
        <div className="flex items-center gap-3 w-full">
          {/* Viewers Label */}
          <div className="text-white/70 text-sm font-medium whitespace-nowrap">
            Viewers ({remoteUsers.size})
          </div>
          
          {/* Horizontal Scroll Container */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-3 pb-2">
              {/* Connected Viewers */}
              {Array.from(remoteUsers.entries()).map(([uid, user]) => (
                <div key={uid} className="flex-shrink-0 w-16 h-16 relative">
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg overflow-hidden flex items-center justify-center text-white font-semibold text-xs">
                    {user.hasVideo && user.videoTrack ? (
                      /* Show video if viewer has camera on */
                      <video 
                        ref={(videoEl) => {
                          if (videoEl && user.videoTrack) {
                            user.videoTrack.play(videoEl);
                          }
                        }}
                        className="w-full h-full object-cover"
                        autoPlay
                        playsInline
                        muted
                      />
                    ) : (
                      /* Show UID if no video */
                      uid.toString().slice(-2)
                    )}
                  </div>
                  
                  {/* Status indicators */}
                  <div className="absolute -bottom-1 -right-1 flex gap-1">
                    {/* Camera status */}
                    <div className={`w-3 h-3 rounded-full border border-gray-900 ${user.hasVideo ? 'bg-blue-400' : 'bg-gray-500'}`}></div>
                    {/* Microphone status */}
                    <div className={`w-3 h-3 rounded-full border border-gray-900 ${user.hasAudio ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                  </div>
                  
                  {/* UID label */}
                  <div className="absolute top-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 rounded-t-lg text-center truncate">
                    {uid}
                  </div>
                </div>
              ))}
              
              {/* Empty State / Demo Tiles - Show when not streaming or no viewers */}
              {(!isStreaming || remoteUsers.size === 0) && (
                <>
                  <div className="flex-shrink-0 w-16 h-16 relative opacity-50">
                    <div className="w-full h-full bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg flex items-center justify-center text-white font-semibold text-xs">
                      42
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-500 rounded-full border-2 border-gray-900"></div>
                    <div className="absolute top-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 rounded-t-lg text-center truncate">
                      42
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-16 h-16 relative opacity-30">
                    <div className="w-full h-full bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg flex items-center justify-center text-white font-semibold text-xs">
                      89
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-500 rounded-full border-2 border-gray-900"></div>
                    <div className="absolute top-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 rounded-t-lg text-center truncate">
                      89
                    </div>
                  </div>
                </>
              )}
              
              {/* Add More Placeholder */}
              <div className="flex-shrink-0 w-16 h-16 border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center text-white/50 text-xs">
                +
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 