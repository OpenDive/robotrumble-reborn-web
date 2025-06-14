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
import { suiCrossyRobotService, GameState as SuiGameState } from '../../../shared/services/suiCrossyRobotService';
import { SuiWalletConnect } from '../shared/SuiWalletConnect';
import { useCurrentAccount, useSignAndExecuteTransaction, useSignTransaction, useSuiClient } from '@mysten/dapp-kit';
import { useEnokiFlow, useZkLogin, useZkLoginSession } from '@mysten/enoki/react';
import { useAuth } from '../../../shared/contexts/AuthContext';

interface ARStreamScreenCrossyRoboProps {
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

export const ARStreamScreenCrossyRobo: React.FC<ARStreamScreenCrossyRoboProps> = ({ session, onBack }) => {
  // Host password protection
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const HOST_PASSWORD = 'crossy2025'; // CrossyRobo specific password
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const uiVideoRef = useRef<HTMLVideoElement>(null);
  
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

  // Crossy Robo control state
  const [messageLog, setMessageLog] = useState<Array<{
    id: string;
    timestamp: string;
    command: string;
    status: 'sent' | 'acknowledged' | 'failed';
  }>>([]);
  const [isControlEnabled, setIsControlEnabled] = useState(true);
  const [selectedRobot, setSelectedRobot] = useState<string>('robot-a');
  
  // Blockchain integration state
  const [suiGameState, setSuiGameState] = useState<SuiGameState | null>(null);
  const [blockchainInitialized, setBlockchainInitialized] = useState(false);
  const [blockchainError, setBlockchainError] = useState<string | null>(null);
  
  // Wallet connection hooks
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const suiClient = useSuiClient();
  
  // Enoki hooks
  const enokiFlow = useEnokiFlow();
  const { address: enokiAddress } = useZkLogin();
  const zkLoginSession = useZkLoginSession();
  
  // Authentication
  const { user } = useAuth();
  
  // Password verification function
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === HOST_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError('');
      console.log('✅ CrossyRobo Host authentication successful');
    } else {
      setPasswordError('Incorrect password. Please try again.');
      setPasswordInput('');
      console.log('❌ CrossyRobo Host authentication failed');
    }
  };
  
  // If not authenticated, show password prompt
  if (!isAuthenticated) {
    return (
      <div className="w-full h-screen bg-[#0B0B1A] relative overflow-hidden flex items-center justify-center">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#0B0B1A]/80 to-[#0B0B1A]"/>
        
        {/* Password Prompt */}
        <div className="relative z-10 bg-black/60 backdrop-blur-sm border border-white/20 rounded-xl p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">CrossyRobo Host Access</h2>
            <p className="text-white/70">Enter the host password to control CrossyRobo</p>
          </div>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter CrossyRobo host password"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                autoFocus
              />
              {passwordError && (
                <p className="mt-2 text-red-400 text-sm">{passwordError}</p>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="medium"
                onClick={onBack}
                className="flex-1 !bg-white/10 hover:!bg-white/20"
              >
                Back
              </Button>
              <button
                type="submit"
                disabled={!passwordInput.trim()}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                Access CrossyRobo Host
              </button>
            </div>
          </form>
          
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-white/50 text-center">
              CrossyRobo Session: {session.trackName} • Channel: {session.id}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
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
                console.log('Webcam video is now playing, starting AR initialization...');
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
            console.error('Webcam video element error:', error);
            setWebcamError('Failed to load webcam video stream');
          };
          
          videoRef.current.addEventListener('loadeddata', onVideoLoaded);
          videoRef.current.addEventListener('error', onVideoError);
          
          const onVideoPlay = () => {
            console.log('Webcam video started playing');
            videoRef.current?.removeEventListener('play', onVideoPlay);
          };
          
          videoRef.current.addEventListener('play', onVideoPlay);
        }
      } catch (webcamError) {
        console.error('Failed to access webcam:', webcamError);
        setWebcamError(`Failed to access camera: ${webcamError instanceof Error ? webcamError.message : String(webcamError)}`);
        setArMode(false);
        
        console.log('❌ Webcam access failed, AR features will be disabled');
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
      console.log('Initializing AR overlay system for Crossy Robo host...');
      
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
        console.log(`[AR Crossy Robo Host] ${message}`);
      });
      arDetectorRef.current = arDetector;
      
      // Get scene and camera from render system
      const scene = renderSystem.getScene();
      const camera = renderSystem.getCamera();
      
      // Initialize AR detector
      await arDetector.initialize(scene || undefined, camera || undefined);
      
      // Start AR rendering loop
      startARRenderingLoop();
      
      console.log('AR overlay system initialized for Crossy Robo host');
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
      if (webcamStream && videoRef.current && arDetectorRef.current) {
        // Check video readiness - only detect if video is properly loaded
        const video = videoRef.current;
        
        // Check video readiness every 60 frames (roughly once per second at 60fps)
        if (frameCount % 60 === 0) {
          console.log(`AR Detection Status (Webcam) - Video ready: ${video.videoWidth}x${video.videoHeight}, Current time: ${video.currentTime}, Paused: ${video.paused}, ReadyState: ${video.readyState}`);
        }
        
        // Only attempt detection if video has valid dimensions and is playing
        if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
          const markers = arDetectorRef.current.detectMarkers(video);
          
          if (markers.length > 0 && frameCount % 60 === 0) {
            console.log(`[AR Crossy Robo Host] Detected ${markers.length} markers`);
          }
          
          setDetectedMarkers(markers);
          
          // Update AR markers in the scene
          if (renderSystemRef.current) {
            renderSystemRef.current.updateAREffects(markers);
            renderSystemRef.current.setAREffectsEnabled(arEffectsEnabled);
            renderSystemRef.current.render();
          }
        } else if (frameCount % 60 === 0) {
          console.log(`[AR Crossy Robo Host] Webcam not ready for detection - waiting...`);
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

  // Initialize blockchain integration
  useEffect(() => {
    const initializeBlockchain = async () => {
      try {
        console.log('🔗 Initializing blockchain integration...');
        
        // Set up wallet connection for blockchain transactions
        if (currentAccount && signAndExecuteTransaction) {
          // Traditional wallet connection (Sui Wallet, etc.)
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

          // Set up the service with traditional wallet connection
          suiCrossyRobotService.setWalletConnection(currentAccount.address, wrappedSignAndExecute);
          console.log('✅ Traditional wallet connected:', currentAccount.address);
          
        } else if (enokiAddress && zkLoginSession) {
          // Enoki wallet connection - use Enoki's direct transaction execution
          const enokiSigner = async (transaction: any): Promise<any> => {
            try {
              // Set the sender address
              transaction.setSender(enokiAddress);
              
              // Build the transaction
              const txBytes = await transaction.build({ client: suiClient });
              
              // Get Enoki keypair and sign
              const signer = await enokiFlow.getKeypair({
                network: 'testnet',
              });
              const signature = await signer.signTransaction(txBytes);
              
              // Execute the transaction
              const result = await suiClient.executeTransactionBlock({
                transactionBlock: txBytes,
                signature: signature.signature,
                requestType: "WaitForLocalExecution",
                options: {
                  showEffects: true,
                  showEvents: true,
                  showObjectChanges: true,
                },
              });
              
              return result;
            } catch (error) {
              console.error('Enoki transaction execution failed:', error);
              throw error;
            }
          };

          // Set up the service with Enoki wallet connection
          suiCrossyRobotService.setWalletConnection(enokiAddress, enokiSigner);
          console.log('✅ Enoki wallet connected with blockchain transaction support');
          console.log('🔐 Using Enoki for automatic zkLogin handling');
        }
        
        const success = await suiCrossyRobotService.initialize();
        if (success) {
          setBlockchainInitialized(true);
          setSuiGameState(suiCrossyRobotService.getGameState());
          console.log('✅ Blockchain integration ready');
        } else {
          throw new Error('Failed to initialize blockchain service');
        }
      } catch (error) {
        console.error('❌ Blockchain initialization failed:', error);
        setBlockchainError(error instanceof Error ? error.message : String(error));
      }
    };

    initializeBlockchain();
  }, [currentAccount, signAndExecuteTransaction, enokiAddress, zkLoginSession]); // Updated deps for Enoki

  // Send directional command or create game
  const sendCommand = async (direction: 'up' | 'down' | 'left' | 'right' | 'stop') => {
    if (!isControlEnabled || !blockchainInitialized) return;
    
    // Check wallet connection - support both traditional wallet and Enoki
    if (!currentAccount && !enokiAddress) {
      const errorMsg = 'Please connect your wallet first';
      setMessageLog(prev => [{
        id: `error-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        command: `Error: ${errorMsg}`,
        status: 'failed' as const
      }, ...prev].slice(0, 20));
      return;
    }
    
    const sendTimestamp = new Date().toLocaleTimeString();
    const commandId = `cmd-${Date.now()}`;
    
    // Handle game creation when stop button is pressed
    if (direction === 'stop') {
      // Add "sent" command to log immediately
      const sentCommand = {
        id: commandId,
        timestamp: sendTimestamp,
        command: `Sent command: Create game`,
        status: 'sent' as const
      };
      
      setMessageLog(prev => [sentCommand, ...prev].slice(0, 20));
      
      // Disable controls temporarily to prevent spam
      setIsControlEnabled(false);
      
      try {
        // Create game using real blockchain service
        const result = await suiCrossyRobotService.createGame();
        
        if (result.success) {
          // Add "acknowledged" command to log with new timestamp
          const ackTimestamp = new Date().toLocaleTimeString();
          const acknowledgedCommand = {
            id: `${commandId}-ack`,
            timestamp: ackTimestamp,
            command: `Game created! TX: ${suiCrossyRobotService.getShortTransactionId(result.transactionId!)}`,
            status: 'acknowledged' as const
          };
          
          setMessageLog(prev => [acknowledgedCommand, ...prev].slice(0, 20));
          
          // Update game state
          setSuiGameState(suiCrossyRobotService.getGameState());
          
          // Auto-connect robot after game creation (this would normally be done by robot)
          setTimeout(async () => {
            try {
              // Check if we have a valid game object ID for robot connection
              const currentGameState = suiCrossyRobotService.getGameState();
              if (!currentGameState.gameObjectId) {
                throw new Error('No valid game object ID available for robot connection');
              }
              
              console.log('🤖 Attempting robot connection with game object ID:', currentGameState.gameObjectId);
              
              const connectResult = await suiCrossyRobotService.connectRobot();
              if (connectResult.success) {
                const connectTimestamp = new Date().toLocaleTimeString();
                const connectCommand = {
                  id: `${commandId}-connect`,
                  timestamp: connectTimestamp,
                  command: `Robot connected! TX: ${suiCrossyRobotService.getShortTransactionId(connectResult.transactionId!)}`,
                  status: 'acknowledged' as const
                };
                
                setMessageLog(prev => [connectCommand, ...prev].slice(0, 20));
                setSuiGameState(suiCrossyRobotService.getGameState());
              } else {
                throw new Error(connectResult.error || 'Robot connection failed');
              }
            } catch (connectError) {
              console.error('Failed to connect robot:', connectError);
              const failTimestamp = new Date().toLocaleTimeString();
              const failCommand = {
                id: `${commandId}-connect-fail`,
                timestamp: failTimestamp,
                command: `Robot connection failed: ${connectError}`,
                status: 'failed' as const
              };
              setMessageLog(prev => [failCommand, ...prev].slice(0, 20));
            }
          }, 1000);
          
        } else {
          throw new Error(result.error || 'Unknown error');
        }
        
      } catch (error) {
        // Add "failed" command to log with new timestamp
        const failTimestamp = new Date().toLocaleTimeString();
        const failedCommand = {
          id: `${commandId}-fail`,
          timestamp: failTimestamp,
          command: `Game creation failed: ${error}`,
          status: 'failed' as const
        };
        
        setMessageLog(prev => [failedCommand, ...prev].slice(0, 20));
        console.error('Failed to create game:', error);
      } finally {
        // Re-enable controls after a short delay
        setTimeout(() => setIsControlEnabled(true), 500);
      }
      
      return; // Exit early for game creation
    }
    
    // Handle regular directional commands
    // Add "sent" command to log immediately
    const sentCommand = {
      id: commandId,
      timestamp: sendTimestamp,
      command: `Sent command: ${direction}`,
      status: 'sent' as const
    };
    
    setMessageLog(prev => [sentCommand, ...prev].slice(0, 20));
    
    // Disable controls temporarily to prevent spam
    setIsControlEnabled(false);
    
    try {
      // Send movement using real blockchain service
      const result = await suiCrossyRobotService.sendMovement(direction.toUpperCase() as 'UP' | 'DOWN' | 'LEFT' | 'RIGHT');
      
      if (result.success) {
        // Add "acknowledged" command to log with new timestamp
        const ackTimestamp = new Date().toLocaleTimeString();
        const acknowledgedCommand = {
          id: `${commandId}-ack`,
          timestamp: ackTimestamp,
          command: `Movement ${direction} confirmed! TX: ${suiCrossyRobotService.getShortTransactionId(result.transactionId!)}`,
          status: 'acknowledged' as const
        };
        
        setMessageLog(prev => [acknowledgedCommand, ...prev].slice(0, 20));
        
        // Update robot position (simulate movement)
        setRobots(prev => prev.map(robot => {
          if (robot.id === selectedRobot) {
            let newPosition = { ...robot.position };
            const moveAmount = 5;
            
            switch (direction) {
              case 'up':
                newPosition.y = Math.max(0, newPosition.y - moveAmount);
                break;
              case 'down':
                newPosition.y = Math.min(100, newPosition.y + moveAmount);
                break;
              case 'left':
                newPosition.x = Math.max(0, newPosition.x - moveAmount);
                break;
              case 'right':
                newPosition.x = Math.min(100, newPosition.x + moveAmount);
                break;
            }
            
            return {
              ...robot,
              position: newPosition,
              status: 'moving'
            };
          }
          return robot;
        }));
        
      } else {
        throw new Error(result.error || 'Unknown error');
      }
      
    } catch (error) {
      // Add "failed" command to log with new timestamp
      const failTimestamp = new Date().toLocaleTimeString();
      const failedCommand = {
        id: `${commandId}-fail`,
        timestamp: failTimestamp,
        command: `Movement failed: ${error}`,
        status: 'failed' as const
      };
      
      setMessageLog(prev => [failedCommand, ...prev].slice(0, 20));
      console.error('Failed to send command:', error);
    } finally {
      // Re-enable controls after a short delay
      setTimeout(() => setIsControlEnabled(true), 500);
    }
  };

  // Robotics control functions (legacy - keeping for compatibility)
  const handleGridClick = (row: number, col: number) => {
    if (!startPoint) {
      setStartPoint({ row, col, id: 'start' });
      setDeliveryStatus('Select end point');
    } else if (!endPoint) {
      setEndPoint({ row, col, id: 'end' });
      setDeliveryStatus('Ready to execute delivery');
    } else {
      // Reset selection
      setStartPoint({ row, col, id: 'start' });
      setEndPoint(null);
      setDeliveryStatus('Select end point');
    }
  };

  // Add periodic debug logging for streaming state
  useEffect(() => {
    if (!isStreaming) return;
    
    const debugInterval = setInterval(() => {
      console.log(`🔍 CROSSY ROBO HOST DEBUG CHECK:`);
      console.log(`  - Local UID: ${localUid}`);
      console.log(`  - Viewers: ${remoteUsers.size}`, Array.from(remoteUsers.keys()));
      console.log(`  - Agora client state:`, rtcClientRef.current?.connectionState);
      console.log(`  - Channel: robot-video`); // Hardcoded channel name
    }, 10000); // Every 10 seconds
    
    return () => clearInterval(debugInterval);
  }, [isStreaming, localUid, remoteUsers]);

  const executeDelivery = async () => {
    if (!startPoint || !endPoint) return;
    
    setPaymentStatus('processing');
    setDeliveryStatus('Processing payment...');
    
    // Simulate payment processing
    setTimeout(() => {
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
      console.log('Starting Crossy Robo stream...');
      
      // Create Agora client
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
      rtcClientRef.current = client;
      
      // Set up client events to detect viewers joining/leaving
      client.on('user-joined', (user) => {
        console.log(`🟢 Viewer ${user.uid} joined the Crossy Robo stream`);
        
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
        console.log(`🔴 Viewer ${user.uid} left the Crossy Robo stream`);
        
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
      
      // Join channel - HARDCODED FOR TESTING
      const channelName = 'robot-video'; // Hardcoded channel name
      const token = await fetchToken(channelName, uid, 'host');
      await client.join(APP_ID, channelName, token, uid);
      console.log(`Joined channel ${channelName} with UID ${uid} as Crossy Robo host`);
      
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
      console.log('✅ Stopped Crossy Robo streaming successfully');
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
                  <p className="text-sm text-white/70">Crossy Robo Stream</p>
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
            {/* Webcam Video */}
            <video 
              ref={videoRef}
              className="w-full h-full object-cover"
              style={{ 
                transform: 'scaleX(-1)', // Mirror the video
                zIndex: 1,
                display: webcamStream ? 'block' : 'none'
              }}
              autoPlay
              playsInline
              muted
            />
            
            {/* Loading status when no webcam */}
            {!webcamStream && !webcamError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
                <div className="text-white text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p>Loading webcam...</p>
                </div>
              </div>
            )}
            
            {/* Show error if webcam fails */}
            {webcamError && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 z-10">
                <div className="text-red-400 text-center p-4">
                  <p className="font-semibold mb-2">Camera Error</p>
                  <p className="text-sm">{webcamError}</p>
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
                  <span className="text-sm font-medium">Broadcasting Crossy Robo</span>
                </div>
                <div className="text-xs text-white/70">
                  Channel: robot-video<br />
                  UID: {localUid}<br />
                  Viewers: {remoteUsers.size}<br />
                  AR Markers: {detectedMarkers.length}<br />
                  Video Source: {webcamStream ? 'Webcam' : 'None'}<br />
                  Video Size: {videoRef.current?.videoWidth}x{videoRef.current?.videoHeight}
                </div>
              </div>
            )}
            
            {/* Debug info when not streaming */}
            {!isStreaming && (
              <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white">
                <div className="text-sm font-medium mb-1">Debug Info</div>
                <div className="text-xs text-white/70">
                  Mode: {arMode ? 'AR (Camera + Overlay)' : '3D (Full Game)'}<br />
                  Video Source: {webcamStream ? 'Webcam Active' : 'Loading...'}<br />
                  AR System: {arMode && renderSystemRef.current ? 'Initialized' : 'Not Active'}<br />
                  3D Game: {!arMode && gameLoopRef.current ? 'Running' : 'Not Active'}<br />
                  Video Size: {videoRef.current?.videoWidth}x{videoRef.current?.videoHeight}<br />
                  AR Markers: {detectedMarkers.length}<br />
                  Channel: robot-video
                  {webcamError && <><br />Webcam Error: {webcamError}</>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Robotics Control Panel */}
        <div className="w-96 bg-gray-900 text-white border-l border-white/10 flex flex-col overflow-hidden">
          {/* Control Panel Header - Fixed */}
          <div className="flex-shrink-0 p-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-white mb-1">Crossy Control</h2>
            <p className="text-sm text-white/70">Navigate robots across the grid safely</p>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Directional Control Pad */}
            <div className="p-4 border-b border-white/10">
              <h3 className="text-sm font-medium text-white mb-3">Robot Control</h3>
              
              {/* Robot Selection */}
              <div className="mb-4">
                <label className="text-xs text-white/70 mb-2 block">Selected Robot</label>
                <select 
                  value={selectedRobot}
                  onChange={(e) => setSelectedRobot(e.target.value)}
                  className="w-full bg-gray-800 border border-white/20 rounded px-3 py-2 text-white text-sm"
                >
                  {robots.map(robot => (
                    <option key={robot.id} value={robot.id}>
                      {robot.name} ({robot.battery}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Control Pad */}
              <div className="bg-gray-800 rounded-lg p-6 flex flex-col items-center">
                {/* Up Button */}
                <button
                  onClick={() => sendCommand('up')}
                  disabled={!isControlEnabled}
                  className={`
                    w-16 h-16 rounded-lg mb-2 flex items-center justify-center text-white font-bold text-xl
                    transition-all duration-150
                    ${isControlEnabled 
                      ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-lg hover:shadow-xl' 
                      : 'bg-gray-600 cursor-not-allowed opacity-50'
                    }
                  `}
                >
                  ↑
                </button>
                
                {/* Middle Row: Left, Stop, Right */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => sendCommand('left')}
                    disabled={!isControlEnabled}
                    className={`
                      w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xl
                      transition-all duration-150
                      ${isControlEnabled 
                        ? 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800 shadow-lg hover:shadow-xl' 
                        : 'bg-gray-600 cursor-not-allowed opacity-50'
                      }
                    `}
                  >
                    ←
                  </button>
                  
                  <button
                    onClick={() => sendCommand('stop')}
                    disabled={!isControlEnabled}
                    className={`
                      w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xs
                      transition-all duration-150
                      ${isControlEnabled 
                        ? 'bg-green-600 hover:bg-green-700 active:bg-green-800 shadow-lg hover:shadow-xl' 
                        : 'bg-gray-600 cursor-not-allowed opacity-50'
                      }
                    `}
                  >
                    Create<br/>Game
                  </button>
                  
                  <button
                    onClick={() => sendCommand('right')}
                    disabled={!isControlEnabled}
                    className={`
                      w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xl
                      transition-all duration-150
                      ${isControlEnabled 
                        ? 'bg-orange-600 hover:bg-orange-700 active:bg-orange-800 shadow-lg hover:shadow-xl' 
                        : 'bg-gray-600 cursor-not-allowed opacity-50'
                      }
                    `}
                  >
                    →
                  </button>
                </div>
                
                {/* Down Button */}
                <button
                  onClick={() => sendCommand('down')}
                  disabled={!isControlEnabled}
                  className={`
                    w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-xl
                    transition-all duration-150
                    ${isControlEnabled 
                      ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-lg hover:shadow-xl' 
                      : 'bg-gray-600 cursor-not-allowed opacity-50'
                    }
                  `}
                >
                  ↓
                </button>
              </div>
              
              {/* Control Status */}
              <div className="mt-3 text-center">
                <span className={`text-xs px-2 py-1 rounded ${
                  isControlEnabled 
                    ? 'bg-green-600/20 text-green-400' 
                    : 'bg-yellow-600/20 text-yellow-400'
                }`}>
                  {isControlEnabled ? 'Ready' : 'Processing...'}
                </span>
              </div>
            </div>

            {/* Message Log */}
            <div className="p-4 border-b border-white/10">
              <h3 className="text-sm font-medium text-white mb-3">Message Log</h3>
              <div className="bg-gray-800 rounded-lg p-3 h-48 overflow-y-auto">
                {messageLog.length === 0 ? (
                  <div className="text-center text-white/50 text-sm py-8">
                    No commands sent yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messageLog.map((message) => (
                      <div key={message.id} className="text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white/70">{message.timestamp}</span>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${
                              message.status === 'sent' ? 'bg-yellow-400' :
                              message.status === 'acknowledged' ? 'bg-green-400' :
                              'bg-red-400'
                            }`} />
                            <span className={`text-xs ${
                              message.status === 'sent' ? 'text-yellow-400' :
                              message.status === 'acknowledged' ? 'text-green-400' :
                              'text-red-400'
                            }`}>
                              {message.status === 'sent' ? 'Sending' :
                               message.status === 'acknowledged' ? 'Received' :
                               'Failed'}
                            </span>
                          </div>
                        </div>
                        <div className="text-white font-medium">
                          {message.command}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Robot Status */}
            <div className="p-4">
              <h3 className="text-sm font-medium text-white mb-3">Robot Status</h3>
              <div className="space-y-2">
                {robots.map((robot) => (
                  <div key={robot.id} className={`
                    flex items-center justify-between bg-gray-800 rounded p-2 border-l-4
                    ${robot.id === selectedRobot ? 'border-blue-400' : 'border-transparent'}
                  `}>
                    <div className="flex items-center gap-2">
                      <div className={`
                        w-2 h-2 rounded-full
                        ${robot.status === 'idle' ? 'bg-blue-400' : 
                          robot.status === 'moving' ? 'bg-yellow-400 animate-pulse' : 
                          'bg-green-400'}
                      `} />
                      <span className="text-sm text-white">{robot.name}</span>
                      {robot.id === selectedRobot && (
                        <span className="text-xs bg-blue-600 text-white px-1 py-0.5 rounded">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/70">
                      {robot.battery}% • {robot.status}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Position Display */}
              <div className="mt-4 bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-white/70 mb-2">Current Position</div>
                {robots.filter(robot => robot.id === selectedRobot).map(robot => (
                  <div key={robot.id} className="text-sm text-white">
                    X: {Math.round(robot.position.x)}, Y: {Math.round(robot.position.y)}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Blockchain Status */}
            <div className="p-4 border-t border-white/10">
              <h3 className="text-sm font-medium text-white mb-3">Blockchain Status</h3>
              
              {/* Connection Status */}
              <div className="bg-gray-800 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/70">Connection</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${
                      blockchainInitialized ? 'bg-green-400' : 'bg-red-400'
                    }`} />
                    <span className={`text-xs ${
                      blockchainInitialized ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {blockchainInitialized ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
                
                {blockchainError && (
                  <div className="text-xs text-red-400 mt-1">
                    {blockchainError}
                  </div>
                )}
              </div>
              
              {/* Game State */}
              {suiGameState && (
                <div className="bg-gray-800 rounded-lg p-3 mb-3">
                  <div className="text-xs text-white/70 mb-2">Game State</div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/70">Game ID:</span>
                      <span className="text-white font-mono">
                        {suiGameState.gameId ? `${suiGameState.gameId.substring(0, 8)}...` : 'None'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-xs">
                      <span className="text-white/70">Robot:</span>
                      <span className={`${suiGameState.isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                        {suiGameState.isConnected ? 'Connected' : 'Pending'}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-xs">
                      <span className="text-white/70">User Balance:</span>
                      <span className="text-white">
                        {suiGameState.balance ? suiGameState.balance.user.toFixed(3) : '0.000'} SUI
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-xs">
                      <span className="text-white/70">Robot Balance:</span>
                      <span className="text-white">
                        {suiGameState.balance ? suiGameState.balance.robot.toFixed(3) : '0.000'} SUI
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Instructions */}
              <div className="bg-blue-600/20 border border-blue-400/30 rounded-lg p-3">
                <div className="text-xs text-blue-400 font-medium mb-1">Instructions</div>
                <div className="text-xs text-blue-300">
                  {!suiGameState?.gameId ? (
                    'Press "Create Game" to start a new blockchain game session'
                  ) : !suiGameState?.isConnected ? (
                    'Waiting for robot to connect...'
                  ) : (
                    'Use directional buttons to send movement commands to the blockchain'
                  )}
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