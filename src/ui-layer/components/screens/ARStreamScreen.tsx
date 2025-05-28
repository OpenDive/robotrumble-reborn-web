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
import { suiDeliveryService, DeliveryState } from '../../../shared/services/suiDeliveryService';
import SuiWalletConnect from '../shared/SuiWalletConnect';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';

interface ARStreamScreenProps {
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

export const ARStreamScreen: React.FC<ARStreamScreenProps> = ({ session, onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const droneDemoVideoRef = useRef<HTMLVideoElement>(null);
  
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
  const [droneVideoElement, setDroneVideoElement] = useState<HTMLVideoElement | null>(null);
  const [droneDemoPlaying, setDroneDemoPlaying] = useState(false);
  const [droneDemoInitialized, setDroneDemoInitialized] = useState(false);
  
  // Robotics control state
  const [startPoint, setStartPoint] = useState<DeliveryPoint | null>(null);
  const [endPoint, setEndPoint] = useState<DeliveryPoint | null>(null);
  const [robots, setRobots] = useState<Robot[]>([
    { id: 'robot-a', name: 'Robot A', position: { x: 80, y: 20 }, status: 'idle', battery: 85 },
    { id: 'robot-b', name: 'Robot B', position: { x: 20, y: 70 }, status: 'idle', battery: 92 }
  ]);
  const [deliveryStatus, setDeliveryStatus] = useState<string>('waiting');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'confirmed' | 'failed'>('pending');
  const [deliveryCost] = useState(0.05);
  
  // Robot animation state
  const [originalRobotAPosition] = useState({ x: 80, y: 20 });
  const [isRobotMoving, setIsRobotMoving] = useState(false);
  
  // Blockchain integration state
  const [suiDeliveryState, setSuiDeliveryState] = useState<DeliveryState | null>(null);
  const [blockchainInitialized, setBlockchainInitialized] = useState(false);
  const [blockchainError, setBlockchainError] = useState<string | null>(null);
  
  // Wallet connection hooks
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  
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
      console.log('Initializing AR overlay system for host...');
      
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
        console.log(`[AR Host] ${message}`);
      });
      arDetectorRef.current = arDetector;
      
      // Get scene and camera from render system
      const scene = renderSystem.getScene();
      const camera = renderSystem.getCamera();
      
      // Initialize AR detector
      await arDetector.initialize(scene || undefined, camera || undefined);
      
      // Start AR rendering loop
      startARRenderingLoop();
      
      console.log('AR overlay system initialized for host');
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
      
      // Run AR detection on webcam video
      if (videoRef.current && arDetectorRef.current) {
        // Check video readiness - only detect if video is properly loaded
        const video = videoRef.current;
        
        // Check video readiness every 60 frames (roughly once per second at 60fps)
        if (frameCount % 60 === 0) {
          console.log(`AR Detection Status - Video ready: ${video.videoWidth}x${video.videoHeight}, Current time: ${video.currentTime}, Paused: ${video.paused}, ReadyState: ${video.readyState}`);
        }
        
        // Only attempt detection if video has valid dimensions and is playing
        if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
          const markers = arDetectorRef.current.detectMarkers(videoRef.current);
          
          if (markers.length > 0 && frameCount % 60 === 0) {
            console.log(`[AR Host] Detected ${markers.length} markers`);
          }
          
          setDetectedMarkers(markers);
          
          // Update AR markers in the scene
          if (renderSystemRef.current) {
            renderSystemRef.current.updateAREffects(markers);
            renderSystemRef.current.setAREffectsEnabled(arEffectsEnabled);
            renderSystemRef.current.render();
          }
        } else if (frameCount % 60 === 0) {
          console.log(`[AR Host] Video not ready for detection - waiting...`);
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

  // Initialize drone demo video
  const initializeDroneDemoVideo = async () => {
    // Prevent duplicate initialization
    if (droneDemoInitialized || droneDemoPlaying) {
      console.log('Drone demo video already initialized, skipping...');
      return;
    }
    
    try {
      console.log('Initializing drone demo video...');
      
      if (droneDemoVideoRef.current) {
        const video = droneDemoVideoRef.current;
        video.src = '/assets/videos/drone1.mov';
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        
        // Set flags immediately to prevent re-initialization
        setDroneDemoInitialized(true);
        
        // Simple approach - just start playing and set state
        video.onloadeddata = () => {
          console.log('Drone demo video loaded successfully');
          video.play().then(() => {
            console.log('Drone demo video is now playing');
            setDroneDemoPlaying(true);
          }).catch((playError) => {
            console.error('Failed to play drone demo video:', playError);
            // Still set as playing to prevent re-initialization
            setDroneDemoPlaying(true);
          });
        };
        
        video.onerror = (error) => {
          console.error('Drone demo video loading error:', error);
          // Still set as initialized to prevent re-initialization
          setDroneDemoPlaying(true);
        };
        
        // Force load the video
        video.load();
        
        console.log('Drone demo video initialization started');
      }
    } catch (error) {
      console.error('Failed to initialize drone demo video:', error);
      // Set as initialized to prevent re-initialization
      setDroneDemoInitialized(true);
      setDroneDemoPlaying(true);
    }
  };

  // Initialize webcam and AR on component mount
  useEffect(() => {
    const initializeWebcamAndAR = async () => {
      // Initialize drone demo video first - only if not already initialized
      if (!droneDemoInitialized && !droneDemoPlaying) {
        await initializeDroneDemoVideo();
      }
      
      // Comment out drone.mp4 testing - we only want drone_demo.mp4
      // await testDroneVideo();
      
      // DISABLE WEBCAM FOR DEMO - we're using drone1.mov instead
      /*
      try {
        console.log('Requesting webcam access...');
        // Start webcam by default
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
      */
      
      // For demo: just set AR mode to true since we have drone1.mov
      console.log('Demo mode: Using drone1.mov instead of webcam');
      setArMode(true);
      
      // Initialize AR system after a short delay to ensure drone video is ready
      setTimeout(() => {
        if (droneDemoPlaying) {
          initializeARSystem();
        }
      }, 1000);
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
      
      // DON'T reset drone demo state on cleanup to prevent re-initialization
      // setDroneDemoPlaying(false);
      // setDroneDemoInitialized(false);
      
      // Stop webcam
      if (webcamStream) {
        console.log('Stopping webcam tracks');
        webcamStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Empty dependency array to run only once

  // Initialize blockchain service
  useEffect(() => {
    const initializeBlockchain = async () => {
      try {
        setBlockchainError(null);
        console.log('🔗 Initializing delivery blockchain integration...');
        
        // Connect wallet if available
        if (currentAccount && signAndExecuteTransaction) {
          // Wrap the mutate function to return a Promise
          const wrappedSignAndExecute = (transaction: any): Promise<any> => {
            return new Promise((resolve, reject) => {
              signAndExecuteTransaction(
                { transaction },
                {
                  onSuccess: (result) => resolve(result),
                  onError: (error) => reject(error)
                }
              );
            });
          };
          
          suiDeliveryService.setWalletConnection(
            currentAccount.address,
            wrappedSignAndExecute
          );
          console.log('✅ Wallet connected to delivery blockchain service');
        }
        
        const success = await suiDeliveryService.initialize();
        if (success) {
          setBlockchainInitialized(true);
          setSuiDeliveryState(suiDeliveryService.getDeliveryState());
          console.log('✅ Delivery blockchain integration ready');
        } else {
          throw new Error('Failed to initialize delivery blockchain service');
        }
      } catch (error) {
        console.error('❌ Delivery blockchain initialization failed:', error);
        setBlockchainError(error instanceof Error ? error.message : String(error));
      }
    };
    
    initializeBlockchain();
  }, [currentAccount, signAndExecuteTransaction]);

  // Robotics control functions
  const handleGridClick = (row: number, col: number) => {
    // Only set start point, no end point needed
    setStartPoint({ row, col, id: 'start' });
    setDeliveryStatus('Ready to execute delivery');
  };

  // Robot movement animation function
  const animateRobotMovement = () => {
    if (!startPoint || isRobotMoving) return;
    
    setIsRobotMoving(true);
    
    // Calculate target position based on grid coordinates
    // Grid is 8x8, so each cell is 12.5% of the total area
    const targetX = (startPoint.col * 12.5) + 6.25; // Center of the grid cell
    const targetY = (startPoint.row * 12.5) + 6.25; // Center of the grid cell
    
    console.log(`Robot A moving to grid position (${startPoint.row}, ${startPoint.col}) = (${targetX}%, ${targetY}%)`);
    
    // Wait 5 seconds after "Delivery in progress..." status
    setTimeout(() => {
      console.log('Starting robot movement to delivery point...');
      
      // Animate movement to start point over 12 seconds
      const startTime = Date.now();
      const duration = 12000; // 12 seconds
      const startPos = { ...originalRobotAPosition };
      
      const animateToTarget = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Smooth easing function
        const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const easedProgress = easeInOut(progress);
        
        // Calculate current position
        const currentX = startPos.x + (targetX - startPos.x) * easedProgress;
        const currentY = startPos.y + (targetY - startPos.y) * easedProgress;
        
        // Update robot position
        setRobots(prev => prev.map(robot => 
          robot.id === 'robot-a' 
            ? { ...robot, position: { x: currentX, y: currentY } }
            : robot
        ));
        
        if (progress < 1) {
          requestAnimationFrame(animateToTarget);
        } else {
          console.log('Robot A reached delivery point, waiting for completion...');
          setIsRobotMoving(false);
          
          // Set robot to 'delivering' status - now waiting for manual completion
          setRobots(prev => prev.map(robot => 
            robot.id === 'robot-a' 
              ? { ...robot, status: 'delivering' }
              : robot
          ));
          
          // Update status to show delivery is ready for completion
          setDeliveryStatus('Robot at delivery point - click "Delivery completed" when ready');
        }
      };
      
      animateToTarget();
    }, 5000); // 5 seconds delay after "Delivery in progress..."
  };

  // Add periodic debug logging for streaming state
  useEffect(() => {
    if (!isStreaming) return;
    
    const debugInterval = setInterval(() => {
      console.log(`🔍 HOST DEBUG CHECK:`);
      console.log(`  - Local UID: ${localUid}`);
      console.log(`  - Viewers: ${remoteUsers.size}`, Array.from(remoteUsers.keys()));
      console.log(`  - Agora client state:`, rtcClientRef.current?.connectionState);
      console.log(`  - Channel: ${session.id}`);
    }, 10000); // Every 10 seconds
    
    return () => clearInterval(debugInterval);
  }, [isStreaming, localUid, remoteUsers, session.id]);

  const executeDelivery = async () => {
    if (!startPoint) return;
    
    // Check wallet connection first
    if (!currentAccount || !blockchainInitialized) {
      setDeliveryStatus('Please connect your wallet first');
      return;
    }
    
    setPaymentStatus('processing');
    setDeliveryStatus('Sending out delivery details for 0.05 SUI');
    
    try {
      // Step 1: Create delivery order on blockchain
      console.log('📦 Creating delivery order on blockchain...');
      const orderResult = await suiDeliveryService.createDeliveryOrder(deliveryCost);
      
      if (orderResult.success) {
        console.log('✅ Delivery order created:', orderResult.transactionId);
        setDeliveryStatus('Sending out job to robots nearby');
        
        // Update delivery state
        setSuiDeliveryState(suiDeliveryService.getDeliveryState());
        
        // Step 2: Auto-connect robot after order creation (simulating robot responding)
        setTimeout(async () => {
          try {
            console.log('🤖 Robot responding to delivery order...');
            const connectResult = await suiDeliveryService.connectRobotToDelivery();
            
            if (connectResult.success) {
              console.log('✅ Robot connected to delivery:', connectResult.transactionId);
              setSuiDeliveryState(suiDeliveryService.getDeliveryState());
              
              // Continue with existing delivery flow
              setPaymentStatus('confirmed');
              setDeliveryStatus('Payment confirmed! Robots negotiating...');
              
              // Simulate robot negotiation
              setTimeout(() => {
                setDeliveryStatus('Robot A selected for delivery');
                setRobots(prev => prev.map(robot => 
                  robot.id === 'robot-a' 
                    ? { ...robot, status: 'moving' }
                    : robot
                ));
                
                // Simulate delivery progress
                setTimeout(() => {
                  setDeliveryStatus('Delivery in progress...');
                  // Trigger robot movement animation
                  animateRobotMovement();
                }, 2000);
              }, 3000);
              
            } else {
              throw new Error(connectResult.error || 'Robot connection failed');
            }
          } catch (connectError) {
            console.error('❌ Robot connection failed:', connectError);
            setPaymentStatus('failed');
            setDeliveryStatus(`Robot connection failed: ${connectError}`);
          }
        }, 2000); // 2 second delay for robot to respond
        
      } else {
        throw new Error(orderResult.error || 'Delivery order creation failed');
      }
      
    } catch (error) {
      console.error('❌ Delivery execution failed:', error);
      setPaymentStatus('failed');
      setDeliveryStatus(`Delivery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const completeDelivery = () => {
    setDeliveryStatus('Delivery completed! Robot unloading...');
    
    // Set robot to 'delivering' status to show it's at the delivery point
    setRobots(prev => prev.map(robot => 
      robot.id === 'robot-a' 
        ? { ...robot, status: 'delivering' }
        : robot
    ));
    
    // Wait 30 seconds at the delivery point (unloading time)
    setTimeout(() => {
      console.log('Starting robot return journey after delivery completion...');
      setDeliveryStatus('Robot returning to base...');
      
      // Get current robot position (should be at delivery point)
      const currentRobots = robots;
      const currentRobot = currentRobots.find(r => r.id === 'robot-a');
      if (!currentRobot) return;
      
      const currentPos = currentRobot.position;
      
      // Animate movement back to original position over 15 seconds
      const returnStartTime = Date.now();
      const returnDuration = 15000; // 15 seconds
      
      const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      
      const animateToOriginal = () => {
        const returnElapsed = Date.now() - returnStartTime;
        const returnProgress = Math.min(returnElapsed / returnDuration, 1);
        const returnEasedProgress = easeInOut(returnProgress);
        
        // Calculate current position (from current back to original)
        const currentX = currentPos.x + (originalRobotAPosition.x - currentPos.x) * returnEasedProgress;
        const currentY = currentPos.y + (originalRobotAPosition.y - currentPos.y) * returnEasedProgress;
        
        // Update robot position
        setRobots(prev => prev.map(robot => 
          robot.id === 'robot-a' 
            ? { ...robot, position: { x: currentX, y: currentY }, status: 'moving' }
            : robot
        ));
        
        if (returnProgress < 1) {
          requestAnimationFrame(animateToOriginal);
        } else {
          console.log('Robot A returned to original position after delivery');
          setIsRobotMoving(false);
          
          // Set robot back to idle status and reset for next delivery
          setRobots(prev => prev.map(robot => 
            robot.id === 'robot-a' 
              ? { ...robot, status: 'idle' }
              : robot
          ));
          
          // Reset everything for next delivery
          setTimeout(() => {
            resetDelivery();
          }, 2000);
        }
      };
      
      animateToOriginal();
    }, 30000); // 30 seconds wait at delivery point
  };

  const resetDelivery = () => {
    setStartPoint(null);
    setEndPoint(null);
    // Don't reset payment status if it's confirmed
    if (paymentStatus !== 'confirmed') {
      setPaymentStatus('pending');
    }
    setDeliveryStatus('waiting');
    setIsRobotMoving(false);
    setRobots(prev => prev.map(robot => 
      robot.id === 'robot-a' 
        ? { ...robot, status: 'idle', position: originalRobotAPosition }
        : { ...robot, status: 'idle' }
    ));
  };

  // Start streaming
  const startStreaming = async () => {
    try {
      setStreamingError(null);
      console.log('Starting robotics demo stream...');
      
      // Create Agora client
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
      rtcClientRef.current = client;
      
      // Set up client events to detect viewers joining/leaving
      client.on('user-joined', (user) => {
        console.log(`🟢 Viewer ${user.uid} joined the stream`);
        
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
        console.log(`🔴 Viewer ${user.uid} left the stream`);
        
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
      console.log(`Joined channel ${session.id} with UID ${uid} as host`);
      
      // Create video track from drone demo video instead of webcam
      try {
        console.log('🎬 Creating video track from drone demo video...');
        
        // Create a video element to load the drone video
        const demoVideo = document.createElement('video');
        demoVideo.src = '/assets/videos/drone1.mov';
        demoVideo.loop = true;
        demoVideo.muted = true;
        demoVideo.playsInline = true;
        demoVideo.crossOrigin = 'anonymous'; // Add CORS support
        
        console.log('📹 Drone video element created, attempting to load...');
        
        // Wait for video to load and start playing
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Drone video loading timeout after 15 seconds'));
          }, 15000);
          
          demoVideo.onloadeddata = () => {
            console.log('✅ Drone demo video loaded successfully');
            console.log(`📐 Video dimensions: ${demoVideo.videoWidth}x${demoVideo.videoHeight}`);
            console.log(`⏱️ Video duration: ${demoVideo.duration}s`);
            clearTimeout(timeout);
            
            demoVideo.play().then(() => {
              console.log('▶️ Drone video is now playing');
              setDroneDemoPlaying(true);
              setDroneDemoInitialized(true);
              resolve(undefined);
            }).catch((playError) => {
              console.error('❌ Failed to play drone video:', playError);
              reject(playError);
            });
          };
          
          demoVideo.onerror = (error) => {
            console.error('❌ Drone video loading error:', error);
            clearTimeout(timeout);
            reject(new Error('Failed to load drone demo video'));
          };
          
          demoVideo.onloadstart = () => {
            console.log('🔄 Drone video loading started...');
          };
          
          demoVideo.oncanplay = () => {
            console.log('✅ Drone video can start playing');
          };
          
          demoVideo.onplaying = () => {
            console.log('🎬 Drone video is playing');
          };
        });
        
        console.log('🎥 Drone video ready, creating Agora video track...');
        
        // Check if captureStream is available
        if (typeof (demoVideo as any).captureStream !== 'function') {
          throw new Error('captureStream not supported in this browser');
        }
        
        // Create video track from the demo video with higher frame rate
        const videoStream = (demoVideo as any).captureStream(30);
        const videoTracks = videoStream.getVideoTracks();
        
        if (videoTracks.length === 0) {
          throw new Error('No video tracks available from drone video stream');
        }
        
        console.log(`📊 Video stream captured with ${videoTracks.length} tracks`);
        console.log(`🎯 Video track settings:`, videoTracks[0].getSettings());
        
        const videoTrack = await AgoraRTC.createCustomVideoTrack({
          mediaStreamTrack: videoTracks[0],
        });
        
        console.log('✅ Agora video track created successfully');
        console.log('🎯 Video track info:', {
          trackId: videoTrack.getTrackId(),
          enabled: videoTrack.enabled,
          muted: videoTrack.muted
        });
        
        // Create audio track from microphone for host commentary
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        console.log('🎤 Audio track created successfully');
        
        localVideoTrackRef.current = videoTrack;
        localAudioTrackRef.current = audioTrack;
        
        // Publish tracks
        console.log('📤 Publishing video and audio tracks...');
        await client.publish([videoTrack, audioTrack]);
        console.log('✅ Published robotics demo stream with drone video');
        
        setIsStreaming(true);
        setDroneVideoElement(demoVideo);
        
        // Add periodic logging to monitor stream health
        const streamMonitor = setInterval(() => {
          console.log('📊 Stream health check:', {
            videoTrackEnabled: videoTrack.enabled,
            videoTrackMuted: videoTrack.muted,
            audioTrackEnabled: audioTrack.enabled,
            audioTrackMuted: audioTrack.muted,
            clientConnectionState: client.connectionState,
            publishedTracks: client.localTracks.length
          });
        }, 10000);
        
        // Store monitor for cleanup
        (client as any)._streamMonitor = streamMonitor;
        
      } catch (videoError) {
        console.error('❌ Failed to create video track from drone video, falling back to webcam:', videoError);
        
        // Fallback to webcam if drone video fails
        if (webcamStream) {
          const [videoTrack, audioTrack] = await Promise.all([
            AgoraRTC.createCustomVideoTrack({
              mediaStreamTrack: webcamStream.getVideoTracks()[0],
            }),
            AgoraRTC.createMicrophoneAudioTrack()
          ]);
          
          localVideoTrackRef.current = videoTrack;
          localAudioTrackRef.current = audioTrack;
          
          // Publish tracks
          await client.publish([videoTrack, audioTrack]);
          console.log('✅ Published robotics demo stream with webcam fallback');
          
          setIsStreaming(true);
        } else {
          throw new Error('No video source available (drone video failed and no webcam)');
        }
      }
    } catch (error) {
      console.error('❌ Error starting stream:', error);
      setStreamingError(`Failed to start stream: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Stop streaming
  const stopStreaming = async () => {
    try {
      if (rtcClientRef.current) {
        // Clean up stream monitor
        if ((rtcClientRef.current as any)._streamMonitor) {
          clearInterval((rtcClientRef.current as any)._streamMonitor);
          console.log('🧹 Cleaned up stream monitor');
        }
        
        if (localVideoTrackRef.current && localAudioTrackRef.current) {
          await rtcClientRef.current.unpublish([localVideoTrackRef.current, localAudioTrackRef.current]);
          console.log('📤❌ Unpublished video and audio tracks');
        }
        
        localVideoTrackRef.current?.close();
        localAudioTrackRef.current?.close();
        console.log('🔒 Closed local tracks');
        
        await rtcClientRef.current.leave();
        console.log('🚪 Left Agora channel');
        
        rtcClientRef.current = null;
        localVideoTrackRef.current = null;
        localAudioTrackRef.current = null;
      }
      
      setIsStreaming(false);
      setLocalUid(null);
      setRemoteUsers(new Map());
      setDroneVideoElement(null);
      console.log('✅ Stopped streaming successfully');
    } catch (error) {
      console.error('❌ Error stopping stream:', error);
    }
  };
  
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
                  <p className="text-sm text-white/70">Robo Delivery Stream</p>
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
            {/* Drone Demo Video - show by default and continue during streaming */}
            <video 
              ref={droneDemoVideoRef}
              className="w-full h-full object-cover"
              style={{ 
                zIndex: 1,
                display: droneDemoPlaying ? 'block' : 'none',
                filter: 'brightness(0.7)'
              }}
              autoPlay
              loop
              playsInline
              muted
            />
            
            {/* Webcam Video Background - DISABLED FOR DEMO 
            <video 
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{ 
                transform: 'scaleX(-1)', // Mirror the video
                zIndex: 1,
                display: (arMode && !droneDemoPlaying && !isStreaming) ? 'block' : 'none'
              }}
              autoPlay
              playsInline
              muted
            />
            */}
            
            {/* Debug overlay to show loading status */}
            {!droneDemoPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
                <div className="text-white text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p>Loading drone demo video...</p>
                </div>
              </div>
            )}
            
            {/* Remove webcam error display since we're not using webcam
            {!droneDemoPlaying && webcamError && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 z-10">
                <div className="text-red-400 text-center p-4">
                  <p className="font-semibold mb-2">Video Error</p>
                  <p className="text-sm">Failed to load drone demo video and camera</p>
                </div>
              </div>
            )}
            */}
            
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
                  <span className="text-sm font-medium">Broadcasting Robotics Demo</span>
                </div>
                <div className="text-xs text-white/70">
                  Channel: {session.id}<br />
                  UID: {localUid}<br />
                  Viewers: {remoteUsers.size}<br />
                  AR Markers: {detectedMarkers.length}<br />
                  Drone Demo: {droneDemoPlaying ? 'Playing' : 'Stopped'}<br />
                  Video Size: {droneDemoVideoRef.current?.videoWidth}x{droneDemoVideoRef.current?.videoHeight}
                </div>
              </div>
            )}
            
            {/* Debug info when not streaming */}
            {!isStreaming && (
              <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white">
                <div className="text-sm font-medium mb-1">Debug Info</div>
                <div className="text-xs text-white/70">
                  Mode: {arMode ? 'AR (Camera + Overlay)' : '3D (Full Game)'}<br />
                  Drone Demo: {droneDemoPlaying ? 'Playing' : 'Loading/Stopped'}<br />
                  AR System: {arMode && renderSystemRef.current ? 'Initialized' : 'Not Active'}<br />
                  3D Game: {!arMode && gameLoopRef.current ? 'Running' : 'Not Active'}<br />
                  Video Size: {droneDemoVideoRef.current?.videoWidth}x{droneDemoVideoRef.current?.videoHeight}<br />
                  AR Markers: {detectedMarkers.length}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Robotics Control Panel */}
        <div className="w-96 bg-gray-900 text-white border-l border-white/10 flex flex-col overflow-hidden">
          {/* Control Panel Header - Fixed */}
          <div className="flex-shrink-0 p-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-white mb-1">Delivery Control</h2>
            <p className="text-sm text-white/70">Click grid to set pickup and delivery points</p>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Delivery Grid */}
            <div className="p-4 border-b border-white/10">
              <h3 className="text-sm font-medium text-white mb-3">Delivery Zone</h3>
              <div className="bg-gray-800 rounded-lg p-4 aspect-square relative overflow-hidden">
                {/* Grid */}
                <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-1">
                  {Array.from({ length: 64 }).map((_, index) => {
                    const row = Math.floor(index / 8);
                    const col = index % 8;
                    const isStart = startPoint && startPoint.row === row && startPoint.col === col;
                    
                    return (
                      <div
                        key={index}
                        className={`
                          border border-white/20 cursor-pointer transition-colors
                          ${isStart ? 'bg-green-500' : ''}
                          ${!isStart ? 'hover:bg-white/10' : ''}
                        `}
                        onClick={() => handleGridClick(row, col)}
                      />
                    );
                  })}
                </div>
                
                {/* Robot Positions */}
                {robots.map((robot) => (
                  <div
                    key={robot.id}
                    className={`
                      absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2
                      ${robot.status === 'idle' ? 'bg-blue-400' : 
                        robot.status === 'moving' ? 'bg-yellow-400 animate-pulse' : 
                        'bg-green-400'}
                    `}
                    style={{
                      left: `${robot.position.x}%`,
                      top: `${robot.position.y}%`
                    }}
                    title={robot.name}
                  />
                ))}
                
                {/* Legend */}
                <div className="absolute bottom-2 left-2 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-green-500 rounded"></div>
                    <span>Start</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Robot Status */}
            <div className="p-4 border-b border-white/10">
              <h3 className="text-sm font-medium text-white mb-3">Robot Status</h3>
              <div className="space-y-2">
                {robots.map((robot) => (
                  <div key={robot.id} className="flex items-center justify-between bg-gray-800 rounded p-2">
                    <div className="flex items-center gap-2">
                      <div className={`
                        w-2 h-2 rounded-full
                        ${robot.status === 'idle' ? 'bg-blue-400' : 
                          robot.status === 'moving' ? 'bg-yellow-400' : 
                          'bg-green-400'}
                      `} />
                      <span className="text-sm">{robot.name}</span>
                    </div>
                    <div className="text-xs text-white/70">
                      {robot.battery}% • {robot.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Payment & Execute */}
            <div className="p-4">
              <h3 className="text-sm font-medium text-white mb-3">Execution</h3>
              
              <div className="space-y-3">
                <div className="bg-gray-800 rounded p-3">
                  <div className="text-xs text-white/70 mb-1">Delivery Cost</div>
                  <div className="text-lg font-bold text-white">{deliveryCost} SUI</div>
                </div>
                
                <div className="bg-gray-800 rounded p-3">
                  <div className="text-xs text-white/70 mb-1">Status</div>
                  <div className="text-sm text-white">{deliveryStatus}</div>
                </div>
                
                <div className="space-y-2">
                  <Button
                    variant="primary"
                    size="small"
                    onClick={executeDelivery}
                    disabled={!startPoint || paymentStatus === 'processing' || paymentStatus === 'confirmed'}
                    className="w-full"
                  >
                    {paymentStatus === 'processing' ? 'Processing...' : 
                     paymentStatus === 'confirmed' ? 'Payment Confirmed ✓' :
                     'Execute Delivery'}
                  </Button>
                  
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={deliveryStatus === 'Robot at delivery point - click "Delivery completed" when ready' ? completeDelivery : resetDelivery}
                    className={`w-full ${
                      deliveryStatus === 'Robot at delivery point - click "Delivery completed" when ready'
                        ? '!bg-yellow-600 hover:!bg-yellow-700 !text-black font-semibold' 
                        : '!bg-gray-700 hover:!bg-gray-600'
                    }`}
                  >
                    {deliveryStatus === 'Robot at delivery point - click "Delivery completed" when ready' ? 'Delivery completed' : 
                     'Delivery completed'}
                  </Button>
                </div>
              </div>
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
