import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import AgoraRTC, { IAgoraRTCClient, IRemoteVideoTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { Button } from '../shared/Button';
import { RaceSession } from '../../../shared/types/race';
import { APP_ID, fetchToken } from '../../../shared/utils/agoraAuth';
import { EnhancedARDetector, DetectedMarker } from '../../../engine-layer/core/ar/EnhancedARDetector';
import { GameRenderSystem } from '../../../engine-layer/core/renderer/GameRenderSystem';
import { SuiWalletConnect } from '../shared/SuiWalletConnect';

interface ARViewerScreenRoboRumbleProps {
  session: RaceSession;
  onBack: () => void;
}

interface RemoteUser {
  uid: number;
  videoTrack?: IRemoteVideoTrack;
  audioTrack?: IRemoteAudioTrack;
  isHost?: boolean;
  hasVideo?: boolean;
  hasAudio?: boolean;
}

interface BattlePoint {
  row: number;
  col: number;
  id: string;
}

interface Robot {
  id: string;
  name: string;
  position: { x: number; y: number };
  status: 'idle' | 'moving' | 'battling' | 'offline';
  battery: number;
}

export const ARViewerScreenRoboRumble: React.FC<ARViewerScreenRoboRumbleProps> = ({ session, onBack }) => {
  const mainViewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // Agora refs
  const rtcClientRef = useRef<IAgoraRTCClient | null>(null);
  
  // Full AR System refs
  const arDetectorRef = useRef<EnhancedARDetector | null>(null);
  const renderSystemRef = useRef<GameRenderSystem | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Streaming state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [localUid, setLocalUid] = useState<number | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<Map<number, RemoteUser>>(new Map());
  const [hostUser, setHostUser] = useState<RemoteUser | null>(null);
  const [viewerUsers, setViewerUsers] = useState<Map<number, RemoteUser>>(new Map());
  
  // Local media state for viewer chat
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<any>(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  
  // AR state
  const [arInitialized, setArInitialized] = useState(false);
  const [detectedMarkers, setDetectedMarkers] = useState<DetectedMarker[]>([]);
  const [arEffectsEnabled, setArEffectsEnabled] = useState(true);

  // Battle control state (read-only for viewers)
  const [startPoint, setStartPoint] = useState<BattlePoint | null>(null);
  const [endPoint, setEndPoint] = useState<BattlePoint | null>(null);
  const [robots, setRobots] = useState<Robot[]>([
    { id: 'robot-a', name: 'Robot A', position: { x: 10, y: 10 }, status: 'idle', battery: 85 },
    { id: 'robot-b', name: 'Robot B', position: { x: 80, y: 60 }, status: 'idle', battery: 92 }
  ]);
  const [battleStatus, setBattleStatus] = useState<string>('waiting');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'confirmed' | 'failed'>('pending');
  const [battleCost] = useState(0.5);

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
      
      // If enabling AR effects, update with current markers
      if (newEnabled && detectedMarkers.length > 0) {
        renderSystemRef.current.updateAREffects(detectedMarkers);
      }
    }
  };

  // Toggle camera for viewer chat
  const toggleCamera = async () => {
    try {
      setMediaError(null);
      
      if (!isCameraEnabled) {
        // Enable camera
        console.log('🎥 Enabling camera...');
        const videoTrack = await AgoraRTC.createCameraVideoTrack({
          optimizationMode: 'detail',
          encoderConfig: '480p_1'
        });
        
        setLocalVideoTrack(videoTrack);
        setIsCameraEnabled(true);
        
        // Publish the video track if connected
        if (rtcClientRef.current && isConnected) {
          await rtcClientRef.current.publish([videoTrack]);
          console.log('📤 Published camera video');
        }
        
        // Play video in local viewer tile
        if (localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
          console.log('📺 Playing local video in viewer tile');
        }
      } else {
        // Disable camera
        console.log('🎥❌ Disabling camera...');
        
        if (localVideoTrack) {
          // Unpublish first if connected
          if (rtcClientRef.current && isConnected) {
            await rtcClientRef.current.unpublish([localVideoTrack]);
            console.log('📤❌ Unpublished camera video');
          }
          
          // Stop and close the track
          localVideoTrack.stop();
          localVideoTrack.close();
          setLocalVideoTrack(null);
        }
        
        setIsCameraEnabled(false);
      }
    } catch (error) {
      console.error('Error toggling camera:', error);
      setMediaError(`Camera error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Toggle microphone for viewer chat
  const toggleMicrophone = async () => {
    try {
      setMediaError(null);
      
      if (!isMicEnabled) {
        // Enable microphone
        console.log('🎤 Enabling microphone...');
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          encoderConfig: 'music_standard'
        });
        
        setLocalAudioTrack(audioTrack);
        setIsMicEnabled(true);
        
        // Publish the audio track if connected
        if (rtcClientRef.current && isConnected) {
          await rtcClientRef.current.publish([audioTrack]);
          console.log('📤 Published microphone audio');
        }
      } else {
        // Disable microphone
        console.log('🎤❌ Disabling microphone...');
        
        if (localAudioTrack) {
          // Unpublish first if connected
          if (rtcClientRef.current && isConnected) {
            await rtcClientRef.current.unpublish([localAudioTrack]);
            console.log('📤❌ Unpublished microphone audio');
          }
          
          // Stop and close the track
          localAudioTrack.stop();
          localAudioTrack.close();
          setLocalAudioTrack(null);
        }
        
        setIsMicEnabled(false);
      }
    } catch (error) {
      console.error('Error toggling microphone:', error);
      setMediaError(`Microphone error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Simulate battle data for demo (in real app, this would come from host)
  useEffect(() => {
    const timer = setTimeout(() => {
      setStartPoint({ row: 2, col: 1, id: 'start' });
      setEndPoint({ row: 5, col: 6, id: 'end' });
      setBattleStatus('Ready to engage');
      setRobots(prev => prev.map(robot => 
        robot.id === 'robot-a' 
          ? { ...robot, status: 'moving' }
          : robot
      ));
    }, 3000); // Show battle points after 3 seconds

    return () => clearTimeout(timer);
  }, []);

  // Send chat message to host and other viewers
  const sendChatMessage = async () => {
    if (!currentMessage.trim() || isSendingMessage || !isConnected || !localUid) return;
    
    setIsSendingMessage(true);
    
    try {
      const timestamp = new Date().toLocaleTimeString();
      const messageId = `msg-${Date.now()}`;
      
      // Add message to local chat immediately
      const newMessage = {
        id: messageId,
        timestamp,
        sender: `Viewer${localUid.toString().slice(-2)}`,
        senderUid: localUid,
        message: currentMessage.trim(),
        isHost: false
      };
      
      setChatMessages(prev => [newMessage, ...prev].slice(0, 100)); // Keep last 100 messages
      
      // Send message to host and other viewers via Agora data channel (simulate for now)
      // In a real implementation, you would use Agora's data stream or a separate messaging service
      console.log(`📤 Viewer sent message: "${currentMessage}" to host and ${remoteUsers.size - 1} other viewers`);
      
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

  // Simulate receiving messages from host and other viewers
  useEffect(() => {
    if (!isConnected) return;
    
    const simulateMessages = () => {
      const hostMessages = [
        "Welcome to the battle arena! 🤖",
        "Robot A is looking strong today",
        "Let's see who wins this round!",
        "Thanks for watching everyone!",
        "The battle is about to begin...",
        "Great crowd today! 🎉",
        "Robot B has some new upgrades",
        "This should be an epic battle!"
      ];
      
      const viewerMessages = [
        "This is so exciting! 🔥",
        "Amazing AR effects!",
        "When does it start?",
        "Best stream ever! 💯",
        "The arena looks incredible",
      ];
      
      const viewerNames = ["RoboWatcher"];
      
      // 60% chance for host message, 40% for viewer message
      const isHostMessage = Math.random() > 0.4;
      const messages = isHostMessage ? hostMessages : viewerMessages;
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      
      const timestamp = new Date().toLocaleTimeString();
      const messageId = `sim-msg-${Date.now()}`;
      
      if (isHostMessage) {
        // Host message
        const hostMessage = {
          id: messageId,
          timestamp,
          sender: 'Host',
          senderUid: hostUser?.uid || 1,
          message: randomMessage,
          isHost: true
        };
        
        setChatMessages(prev => [hostMessage, ...prev].slice(0, 100));
        console.log(`📥 Received host message: "${randomMessage}"`);
      } else {
        // Other viewer message
        const randomName = viewerNames[Math.floor(Math.random() * viewerNames.length)];
        const randomUid = Math.floor(Math.random() * 90000) + 10000; // Random 5-digit UID
        
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
    
    // Start simulating messages after 8 seconds, then every 6-12 seconds
    const initialTimer = setTimeout(() => {
      simulateMessages();
      const interval = setInterval(() => {
        if (Math.random() > 0.2) { // 80% chance to send a message
          simulateMessages();
        }
      }, 6000 + Math.random() * 6000); // 6-12 seconds
      
      return () => clearInterval(interval);
    }, 8000);
    
    return () => clearTimeout(initialTimer);
  }, [isConnected, hostUser]);

  // Initialize full AR system with complete 3D scene
  const initializeAROverlay = async () => {
    if (!canvasRef.current || arInitialized) return;
    
    try {
      console.log('Initializing full AR system for Robo Rumble viewer...');
      
      // Ensure canvas matches its container size
      const container = canvasRef.current.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
        console.log(`AR Canvas sized to container: ${rect.width}x${rect.height}`);
      }
      
      // Create full GameRenderSystem for complete 3D AR experience
      const renderSystem = new GameRenderSystem();
      renderSystemRef.current = renderSystem;
      
      // Initialize with transparent background for overlay
      renderSystem.initialize(canvasRef.current);
      
      // Set AR mode to enable transparent rendering
      renderSystem.setARMode(true);
      
      // Enable AR effects by default
      renderSystem.setAREffectsEnabled(arEffectsEnabled);
      
      // Create AR detector for marker detection
      const arDetector = new EnhancedARDetector((message) => {
        console.log(`[AR Robo Rumble Viewer] ${message}`);
      });
      arDetectorRef.current = arDetector;
      
      // Get scene and camera from render system
      const scene = renderSystem.getScene();
      const camera = renderSystem.getCamera();
      
      // Initialize AR detector with full 3D context
      await arDetector.initialize(scene || undefined, camera || undefined);
      
      // Start full AR rendering loop
      startARRenderingLoop();
      
      setArInitialized(true);
      console.log('Full AR system initialized for Robo Rumble viewer');
    } catch (error) {
      console.error('Failed to initialize AR system:', error);
    }
  };

  // Full AR rendering loop with complete 3D scene
  const startARRenderingLoop = () => {
    if (!arDetectorRef.current || !renderSystemRef.current) return;
    
    let frameCount = 0;
    
    const renderLoop = () => {
      frameCount++;
      
      // Run AR detection on host video
      if (hostVideoRef.current && arDetectorRef.current) {
        // Check video readiness every 60 frames (roughly once per second at 60fps)
        if (frameCount % 60 === 0) {
          const video = hostVideoRef.current;
          console.log(`AR Detection Status - Video ready: ${video.videoWidth}x${video.videoHeight}, Current time: ${video.currentTime}, Paused: ${video.paused}`);
        }
        
        const markers = arDetectorRef.current.detectMarkers(hostVideoRef.current);
        
        if (markers.length > 0) {
          console.log(`[AR Robo Rumble Viewer] Detected ${markers.length} markers on host stream`);
        }
        
        setDetectedMarkers(markers);
        
        // Update AR markers in the full 3D scene
        if (renderSystemRef.current) {
          renderSystemRef.current.updateAREffects(markers);
          
          // Set AR effects visibility
          renderSystemRef.current.setAREffectsEnabled(arEffectsEnabled);
          
          // Render the complete 3D AR scene
          renderSystemRef.current.render();
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };
    
    animationFrameRef.current = requestAnimationFrame(renderLoop);
  };

  // Cleanup full AR system
  const cleanupAROverlay = () => {
    console.log('Cleaning up AR system...');
    
    // Stop animation loop
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Dispose render system
    if (renderSystemRef.current) {
      renderSystemRef.current.dispose();
      renderSystemRef.current = null;
    }
    
    if (arDetectorRef.current) {
      arDetectorRef.current.dispose();
      arDetectorRef.current = null;
    }
    
    setArInitialized(false);
    setDetectedMarkers([]);
  };

  // Connect to stream
  const connectToStream = async () => {
    try {
      setConnectionError(null);
      console.log('Connecting to Robo Rumble stream...');
      
      // Create Agora client
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
      rtcClientRef.current = client;
      
      // Set up client events
      client.on('user-joined', (user) => {
        console.log(`🟢 User ${user.uid} joined the Robo Rumble channel`);
        
        // Add user to remoteUsers immediately when they join
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          const newUser: RemoteUser = { uid: user.uid as number };
          newMap.set(user.uid as number, newUser);
          console.log(`📊 Updated remoteUsers, now has ${newMap.size} users:`, Array.from(newMap.keys()));
          return newMap;
        });
      });
      
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        console.log(`📺 Subscribed to ${mediaType} from user ${user.uid}`);
        
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          const existingUser = newMap.get(user.uid as number) || { uid: user.uid as number };
          
          if (mediaType === 'video' && user.videoTrack) {
            existingUser.videoTrack = user.videoTrack;
            existingUser.hasVideo = true;
            
            // Determine if this is the host (first video publisher or has higher authority)
            // For simplicity, treat the first video publisher as host
            if (!hostUser) {
              console.log(`👑 User ${user.uid} is now the Robo Rumble HOST`);
              // This is the host - display in main view with AR
              existingUser.isHost = true;
              setHostUser(existingUser);
              
              // If no host yet, create a fallback video for synchronized viewing
              setTimeout(() => {
                console.log(`🎬 No host detected, starting local robo rumble video for synchronized viewing`);
                
                // Create main video view
                const mainContainer = document.createElement('div');
                mainContainer.id = `main-roborumble-video`;
                mainContainer.className = 'absolute inset-0 w-full h-full bg-black';
                
                const roboRumbleVideo = document.createElement('video');
                roboRumbleVideo.className = 'w-full h-full object-cover';
                roboRumbleVideo.autoplay = true;
                roboRumbleVideo.playsInline = true;
                roboRumbleVideo.muted = true;
                roboRumbleVideo.loop = true;
                roboRumbleVideo.style.transform = 'scaleX(-1)'; // Mirror the video
                roboRumbleVideo.style.filter = 'brightness(0.8)'; // Match host screen brightness
                roboRumbleVideo.id = `roborumble-video`;
                roboRumbleVideo.src = '/assets/videos/robot_rumble.mp4'; // Play the robo rumble video locally
                
                console.log(`🎥 Loading robo rumble video locally for synchronized viewing`);
                
                // Add event listeners for debugging
                roboRumbleVideo.addEventListener('loadeddata', () => {
                  console.log(`📹 Local robo rumble video loaded: ${roboRumbleVideo.videoWidth}x${roboRumbleVideo.videoHeight}`);
                });
                
                roboRumbleVideo.addEventListener('playing', () => {
                  console.log(`📹 Local robo rumble video is playing`);
                });
                
                roboRumbleVideo.addEventListener('error', async (e) => {
                  console.error(`❌ Local robo rumble video error:`, e);
                  console.log('🔄 Fallback to webcam for synchronized viewing...');
                  
                  try {
                    // Fallback to webcam
                    const stream = await navigator.mediaDevices.getUserMedia({ 
                      video: { 
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                      } 
                    });
                    
                    console.log('📹 Webcam access granted for viewer');
                    
                    // Replace robo rumble video with webcam video
                    roboRumbleVideo.srcObject = stream;
                    roboRumbleVideo.src = ''; // Clear the src
                    roboRumbleVideo.style.transform = 'scaleX(-1)'; // Mirror webcam
                    
                    console.log('✅ Using webcam as fallback for synchronized viewing');
                  } catch (webcamError) {
                    console.error('❌ Failed to access webcam as fallback:', webcamError);
                    
                    // Show error message in video container
                    mainContainer.innerHTML = `
                      <div class="w-full h-full flex items-center justify-center bg-gray-800 text-white">
                        <div class="text-center">
                          <p class="text-lg font-semibold mb-2">Video Source Error</p>
                          <p class="text-sm">Failed to load demo video and camera</p>
                        </div>
                      </div>
                    `;
                  }
                });
                
                mainContainer.appendChild(roboRumbleVideo);
                
                // Store reference for AR detection
                hostVideoRef.current = roboRumbleVideo;
                
                // Add to main view container
                if (mainViewRef.current) {
                  console.log(`📺 Adding local robo rumble video to main view`);
                  mainViewRef.current.appendChild(mainContainer);
                  
                  // Start playing the video
                  roboRumbleVideo.play().then(() => {
                    console.log(`✅ Local robo rumble video started playing successfully`);
                    
                    // Initialize AR overlay once video is playing
                    setTimeout(() => {
                      if (roboRumbleVideo.videoWidth > 0 && roboRumbleVideo.videoHeight > 0) {
                        console.log(`📐 Video dimensions ready: ${roboRumbleVideo.videoWidth}x${roboRumbleVideo.videoHeight}`);
                        initializeAROverlay();
                      }
                    }, 500);
                    
                  }).catch((playError) => {
                    console.error(`❌ Failed to play local robo rumble video:`, playError);
                    // Error handler above will handle fallback to webcam
                  });
                } else {
                  console.error(`❌ mainViewRef.current is null`);
                }
              }, 1000);
            } else {
              console.log(`👥 User ${user.uid} is a VIEWER with video`);
              // This is a viewer - display in participant tile
              existingUser.isHost = false;
              setViewerUsers(prev => new Map(prev.set(user.uid as number, existingUser)));
            }
          }
          
          if (mediaType === 'audio' && user.audioTrack) {
            existingUser.audioTrack = user.audioTrack;
            existingUser.hasAudio = true;
            user.audioTrack.play();
            console.log(`🔊 Playing audio for user ${user.uid}`);
          }
          
          newMap.set(user.uid as number, existingUser);
          return newMap;
        });
      });
      
      client.on('user-unpublished', (user, mediaType) => {
        console.log(`🔇 User ${user.uid} unpublished ${mediaType}`);
        
        if (mediaType === 'video') {
          const remoteUser = remoteUsers.get(user.uid as number);
          if (remoteUser?.isHost) {
            // Host stopped streaming - clean up main view and AR
            const mainContainer = document.getElementById(`main-roborumble-video`);
            if (mainContainer) {
              mainContainer.remove();
            }
            cleanupAROverlay();
            setHostUser(null);
            console.log(`👑❌ Robo Rumble host stopped streaming`);
          }
        }
        
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          const existingUser = newMap.get(user.uid as number);
          if (existingUser) {
            if (mediaType === 'video') {
              delete existingUser.videoTrack;
              existingUser.hasVideo = false;
            }
            if (mediaType === 'audio') {
              delete existingUser.audioTrack;
              existingUser.hasAudio = false;
            }
            
            // Keep the user in remoteUsers even if they're not publishing
            newMap.set(user.uid as number, existingUser);
          }
          return newMap;
        });
      });
      
      client.on('user-left', (user) => {
        console.log(`🔴 User ${user.uid} left the Robo Rumble channel`);
        
        // If host left, clean up main view
        const remoteUser = remoteUsers.get(user.uid as number);
        if (remoteUser?.isHost) {
          const mainContainer = document.getElementById(`main-roborumble-video`);
          if (mainContainer) {
            mainContainer.remove();
          }
          cleanupAROverlay();
          setHostUser(null);
          console.log(`👑🚪 Robo Rumble host left`);
        }
        
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(user.uid as number);
          return newMap;
        });
        
        setViewerUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(user.uid as number);
          return newMap;
        });
      });
      
      // Set client role to host (not audience) so that host can detect when we join
      await client.setClientRole('host');
      
      // Generate UID
      const uid = Math.floor(Math.random() * 100000);
      setLocalUid(uid);
      
      // Join channel
      const token = await fetchToken(session.id, uid, 'host');
      await client.join(APP_ID, session.id, token, uid);
      console.log(`Joined channel ${session.id} with UID ${uid} as Robo Rumble viewer`);
      
      // Auto-publish local media if already enabled
      const tracksToPublish = [];
      if (localVideoTrack && isCameraEnabled) {
        tracksToPublish.push(localVideoTrack);
        console.log('📤 Auto-publishing existing camera video');
      }
      if (localAudioTrack && isMicEnabled) {
        tracksToPublish.push(localAudioTrack);
        console.log('📤 Auto-publishing existing microphone audio');
      }
      
      if (tracksToPublish.length > 0) {
        await client.publish(tracksToPublish);
        console.log(`📤 Published ${tracksToPublish.length} existing media tracks`);
      }
      
      setIsConnected(true);
    } catch (error) {
      console.error('Error connecting to stream:', error);
      setConnectionError(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Disconnect from stream
  const disconnectFromStream = async () => {
    try {
      // Clean up AR overlay first
      cleanupAROverlay();
      
      // Clean up local media tracks
      if (localVideoTrack) {
        localVideoTrack.stop();
        localVideoTrack.close();
        setLocalVideoTrack(null);
      }
      
      if (localAudioTrack) {
        localAudioTrack.stop();
        localAudioTrack.close();
        setLocalAudioTrack(null);
      }
      
      setIsCameraEnabled(false);
      setIsMicEnabled(false);
      setMediaError(null);

      if (rtcClientRef.current) {
        // Leave channel
        await rtcClientRef.current.leave();
        
        // Clear refs
        rtcClientRef.current = null;
      }
      
      // Clear all containers
      if (mainViewRef.current) {
        mainViewRef.current.innerHTML = '';
      }
      const participantGrid = document.getElementById('participant-grid');
      if (participantGrid) {
        participantGrid.innerHTML = '';
      }
      
      // Clean up RoboRumble video container
      const roboRumbleContainer = document.getElementById('main-roborumble-video');
      if (roboRumbleContainer) {
        roboRumbleContainer.remove();
        console.log('🗑️ Cleaned up RoboRumble video container');
      }
      
      setIsConnected(false);
      setLocalUid(null);
      setRemoteUsers(new Map());
      setHostUser(null);
      setViewerUsers(new Map());
      console.log('Disconnected from Robo Rumble stream');
    } catch (error) {
      console.error('Error disconnecting from stream:', error);
    }
  };

  // Handle window resize
  useEffect(() => {
    // Set up resize observer for canvas sizing
    let resizeObserver: ResizeObserver | null = null;
    
    if (canvasRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (canvasRef.current) {
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            console.log(`AR Canvas resized to: ${width}x${height}`);
            
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
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAROverlay();
      disconnectFromStream();
    };
  }, []);

  return (
    <div className="w-full h-screen bg-[#0B0B1A] relative overflow-hidden flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#0B0B1A]/80 to-[#0B0B1A]"/>
      
      {/* Header */}
      <div className="relative z-30 bg-gradient-to-r from-game-900/50 via-game-800/50 to-game-900/50 backdrop-blur-sm border-b border-white/5 p-4">
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
              <p className="text-sm text-white/70">RoboRumble AR Stream {arInitialized && '(AR Active)'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Camera Toggle */}
            {isConnected && (
              <Button
                variant="secondary"
                size="small"
                onClick={toggleCamera}
                className={`${isCameraEnabled ? '!bg-blue-600 hover:!bg-blue-700' : '!bg-white/10 hover:!bg-white/20'}`}
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isCameraEnabled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 21l-4.95-4.95m0 0L5.636 5.636M18.364 18.364L12 12" />
                  )}
                </svg>
                {isCameraEnabled ? 'Camera On' : 'Camera Off'}
              </Button>
            )}

            {/* Microphone Toggle */}
            {isConnected && (
              <Button
                variant="secondary"
                size="small"
                onClick={toggleMicrophone}
                className={`${isMicEnabled ? '!bg-green-600 hover:!bg-green-700' : '!bg-white/10 hover:!bg-white/20'}`}
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMicEnabled ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-3a1 1 0 011-1h1m0 0V7a3 3 0 013-3m3 3v3m0 0a1 1 0 001 1h1m-1 0v3a1 1 0 01-1 1H9a1 1 0 01-1-1v-3m0 0a1 1 0 011-1h1m0 0V7a3 3 0 013-3m3 3v3" />
                  )}
                </svg>
                {isMicEnabled ? 'Mic On' : 'Mic Off'}
              </Button>
            )}

            {/* AR Status */}
            {arInitialized && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-blue-400 text-sm">AR Detection</span>
              </div>
            )}
            
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-white/90 text-sm">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            {/* Participants Count */}
            {isConnected && (
              <div className="text-white/70 text-sm">
                {remoteUsers.size} Participant{remoteUsers.size !== 1 ? 's' : ''}
              </div>
            )}
            
            {/* Connection Controls */}
            {!isConnected ? (
              <Button
                variant="primary"
                size="small"
                onClick={connectToStream}
                disabled={!!connectionError}
              >
                Join Stream
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="small"
                onClick={disconnectFromStream}
                className="!bg-red-600 hover:!bg-red-700"
              >
                Leave Stream
              </Button>
            )}
            
            {/* Wallet Connect */}
            <div className="ml-2">
              <SuiWalletConnect />
            </div>
          </div>
        </div>
        
        {/* Error Messages */}
        {connectionError && (
          <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
            {connectionError}
          </div>
        )}
        
        {mediaError && (
          <div className="mt-2 p-2 bg-yellow-500/20 border border-yellow-500/30 rounded text-yellow-400 text-sm">
            {mediaError}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex" style={{ height: 'calc(100vh - 10rem)' }}>
        {!isConnected ? (
          /* Not Connected State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-white/70">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Ready to Join RoboRumble Session</h3>
              <p className="text-sm mb-4">Connect to watch the synchronized RoboRumble demo with AR overlay</p>
              <p className="text-xs text-white/50">Channel: {session.id}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Left Side: Main AR View Area */}
            <div className="flex-1 relative">
              {!hostUser ? (
                /* Waiting for Host */
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-white/70">
                    <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">Waiting for Battle Session</h3>
                    <p className="text-sm mb-4">RoboRumble demo will start when host begins session</p>
                    <p className="text-xs text-white/50">Participants: {remoteUsers.size}</p>
                  </div>
                </div>
              ) : null}

              {/* Host Video Container - populated dynamically */}
              <div 
                ref={mainViewRef} 
                className="absolute inset-0 w-full h-full"
                style={{ zIndex: 1 }}
              />

              {/* AR Overlay Canvas */}
              {hostUser && (
                <canvas 
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    zIndex: 2,
                    background: 'transparent',
                    display: arInitialized ? 'block' : 'none',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%'
                  }}
                />
              )}

              {/* Stream Info Overlay */}
              {isConnected && (
                <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">Watching RoboRumble AR Stream</span>
                  </div>
                  <div className="text-xs text-white/70">
                    Channel: {session.id}<br />
                    Your UID: {localUid}<br />
                    Host: {hostUser ? `User ${hostUser.uid}` : 'None'}<br />
                    Viewers: {remoteUsers.size}<br />
                    {arInitialized && `AR Markers: ${detectedMarkers.length}`}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Battle Control Panel (Read-only for viewers) */}
            <div className="w-96 bg-gray-900 text-white border-l border-white/10 flex flex-col overflow-hidden relative z-20">
              {/* Chat Header - Fixed */}
              <div className="flex-shrink-0 p-4 border-b border-white/10 relative z-10">
                <h2 className="text-lg font-bold text-white mb-1 relative z-10">Rumble Chat</h2>
                <p className="text-sm text-white/70 relative z-10">Chat with host and other viewers</p>
                {isConnected && (
                  <div className="mt-2 flex items-center gap-2 relative z-10">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs text-green-400">
                      {hostUser ? 'Host online' : 'Waiting for host'} • {Math.max(0, remoteUsers.size - (hostUser ? 1 : 0))} viewers
                    </span>
                  </div>
                )}
              </div>
              
              {/* Chat Messages - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 relative z-10">
                <div className="space-y-3 relative z-10">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-white/50 text-sm py-8 relative z-10">
                      {isConnected ? 'Chat is ready! Say hello...' : 'Connect to join the chat'}
                    </div>
                  ) : (
                    chatMessages.map((msg) => (
                      <div key={msg.id} className={`
                        flex flex-col gap-1 p-3 rounded-lg relative z-10
                        ${msg.isHost 
                          ? 'bg-blue-600/20 border-l-4 border-blue-400 mr-4' 
                          : msg.senderUid === localUid
                            ? 'bg-green-600/20 border-l-4 border-green-400 ml-4'
                            : 'bg-gray-800/50 border-l-4 border-purple-400 mr-4'
                        }
                      `}>
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex items-center gap-2 relative z-10">
                            <span className={`text-xs font-medium relative z-10 ${
                              msg.isHost ? 'text-blue-400' : 
                              msg.senderUid === localUid ? 'text-green-400' : 'text-purple-400'
                            }`}>
                              {msg.senderUid === localUid ? 'You' : msg.sender}
                            </span>
                            {msg.isHost && (
                              <span className="text-xs bg-blue-600 text-white px-1 py-0.5 rounded relative z-10">
                                HOST
                              </span>
                            )}
                            {msg.senderUid === localUid && (
                              <span className="text-xs bg-green-600 text-white px-1 py-0.5 rounded relative z-10">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-white/50 relative z-10">{msg.timestamp}</span>
                        </div>
                        <div className="text-sm text-white break-words relative z-10">
                          {msg.message}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {/* Chat Input - Fixed at bottom */}
              <div className="flex-shrink-0 p-4 border-t border-white/10 relative z-10">
                <div className="flex gap-2 relative z-10">
                  <input
                    type="text"
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onKeyPress={handleChatKeyPress}
                    placeholder={isConnected ? "Type a message..." : "Connect to chat"}
                    disabled={!isConnected || isSendingMessage}
                    className="flex-1 bg-gray-800 border border-white/20 rounded px-3 py-2 text-white text-sm
                              placeholder-white/50 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400
                              disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                    maxLength={200}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!isConnected || !currentMessage.trim() || isSendingMessage}
                    className={`
                      px-4 py-2 rounded text-sm font-medium transition-all duration-150 relative z-20 pointer-events-auto
                      ${(!isConnected || !currentMessage.trim() || isSendingMessage)
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                        : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl'
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
                <div className="mt-2 text-xs text-white/50 relative z-10">
                  {isConnected ? (
                    <>
                      Press Enter to send • {currentMessage.length}/200 characters
                    </>
                  ) : (
                    'Connect to stream to enable chat'
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Viewer Panel */}
      {isConnected && (
        <div className="h-24 bg-gray-900/90 backdrop-blur-sm border-t border-white/10 flex items-center px-4 flex-shrink-0">
          <div className="flex items-center gap-3 w-full">
            {/* Viewers Label */}
            <div className="text-white/70 text-sm font-medium whitespace-nowrap">
              Viewers ({isConnected ? Math.max(0, remoteUsers.size - (hostUser ? 1 : 0)) + 1 : 0})
            </div>
            
            {/* Horizontal Scroll Container */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600 hover:scrollbar-thumb-gray-500">
              <div className="flex gap-3 pb-2 min-w-max">
                {/* Local viewer tile (you) */}
                {localUid && (
                  <div className="flex-shrink-0 w-16 h-16 relative">
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg overflow-hidden border-2 border-blue-400 relative">
                      {isCameraEnabled ? (
                        <video 
                          ref={localVideoRef}
                          className="w-full h-full object-cover"
                          autoPlay
                          playsInline
                          muted
                          style={{ transform: 'scaleX(-1)' }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white font-semibold text-xs">
                          YOU
                        </div>
                      )}
                    </div>
                    
                    {/* Status indicators */}
                    <div className="absolute -bottom-1 -right-1 flex gap-1">
                      <div className={`w-3 h-3 rounded-full border border-gray-900 ${isCameraEnabled ? 'bg-blue-400' : 'bg-gray-500'}`}></div>
                      <div className={`w-3 h-3 rounded-full border border-gray-900 ${isMicEnabled ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                    </div>
                    
                    {/* UID label */}
                    <div className="absolute top-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 rounded-t-lg text-center truncate">
                      {localUid}
                    </div>
                  </div>
                )}
                
                {/* Other viewers */}
                {Array.from(remoteUsers.entries())
                  .filter(([uid, user]) => uid !== hostUser?.uid)
                  .map(([uid, user]) => (
                    <div key={uid} className="flex-shrink-0 w-16 h-16 relative">
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center text-white font-semibold text-xs overflow-hidden">
                        {user.hasVideo && user.videoTrack ? (
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
                          uid.toString().slice(-2)
                        )}
                      </div>
                      
                      {/* Status indicators */}
                      <div className="absolute -bottom-1 -right-1 flex gap-1">
                        <div className={`w-3 h-3 rounded-full border border-gray-900 ${user.hasVideo ? 'bg-blue-400' : 'bg-gray-500'}`}></div>
                        <div className={`w-3 h-3 rounded-full border border-gray-900 ${user.hasAudio ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                      </div>
                      
                      {/* UID label */}
                      <div className="absolute top-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 rounded-t-lg text-center truncate">
                        {uid}
                      </div>
                    </div>
                  ))
                }
                
                {/* Host tile if present */}
                {hostUser && (
                  <div className="flex-shrink-0 w-16 h-16 relative">
                    <div className="w-full h-full bg-gradient-to-br from-green-500 to-green-700 rounded-lg flex items-center justify-center text-white font-semibold text-xs border-2 border-green-400">
                      HOST
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-gray-900"></div>
                    <div className="absolute top-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 rounded-t-lg text-center truncate">
                      {hostUser.uid}
                    </div>
                  </div>
                )}
                
                {/* Add More Placeholder */}
                <div className="flex-shrink-0 w-16 h-16 border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center text-white/50 text-xs">
                  +
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 