import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import AgoraRTC, { ICameraVideoTrack, IMicrophoneAudioTrack, IAgoraRTCClient } from 'agora-rtc-sdk-ng';
import { GamePhysicsSystem } from '../../../engine-layer/core/physics/GamePhysicsSystem';
import { GameRenderSystem } from '../../../engine-layer/core/renderer/GameRenderSystem';
import { InputController } from '../../../engine-layer/core/input/InputController';
import { GameLoop } from '../../../engine-layer/core/game/GameLoop';
import { GameHUD } from '../hud/GameHUD';
import { GameState, KeyState } from '../../../shared/types/GameTypes';
import { EnhancedARDetector, DetectedMarker } from '../../../engine-layer/core/ar/EnhancedARDetector';
import { Button } from '../shared/Button';
import { RaceSession } from '../../../shared/types/race';
import { APP_ID, fetchToken } from '../../../shared/utils/agoraAuth';

interface ARStreamScreenProps {
  session: RaceSession;
  onBack: () => void;
}

export const ARStreamScreen: React.FC<ARStreamScreenProps> = ({ session, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  
  // System refs
  const physicsSystemRef = useRef<GamePhysicsSystem | null>(null);
  const renderSystemRef = useRef<GameRenderSystem | null>(null);
  const inputControllerRef = useRef<InputController | null>(null);
  const gameLoopRef = useRef<GameLoop | null>(null);
  const arDetectorRef = useRef<EnhancedARDetector | null>(null);
  
  // Agora refs
  const rtcClientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  
  // Add cleanup tracking to prevent race conditions
  const cleanupInProgressRef = useRef(false);
  const initializationInProgressRef = useRef(false);
  
  // Game state
  const [gameState, setGameState] = useState<GameState>({
    position: new THREE.Vector3(0, 1, 0),
    rotation: 0,
    velocity: new THREE.Vector2(0, 0),
    isColliding: false
  });
  
  // Input state
  const [keys, setKeys] = useState<KeyState>({
    forward: false,
    backward: false,
    left: false,
    right: false
  });
  
  // AR mode state
  const [arMode, setArMode] = useState(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [detectedMarkers, setDetectedMarkers] = useState<DetectedMarker[]>([]);
  
  // Streaming state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingError, setStreamingError] = useState<string | null>(null);
  const [localUid, setLocalUid] = useState<number | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<Map<number, any>>(new Map());
  
  // Debug state for testing video visibility
  const [debugHideCanvas, setDebugHideCanvas] = useState(false);
  
  // Debug markers state
  const [debugMarkersEnabled, setDebugMarkersEnabled] = useState(false);
  
  // Debug markers toggle handler
  const toggleDebugMarkers = () => {
    const newEnabled = !debugMarkersEnabled;
    setDebugMarkersEnabled(newEnabled);
    
    if (renderSystemRef.current) {
      renderSystemRef.current.setDebugMarkersEnabled(newEnabled);
      
      // If enabling debug markers in AR mode, update markers
      if (newEnabled && arMode && detectedMarkers.length > 0) {
        renderSystemRef.current.updateARMarkers(detectedMarkers);
      }
    }
  };
  
  // AR mode toggle handler
  const toggleARMode = async () => {
    if (!arMode) {
      // Entering AR mode - start webcam
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment' // Prefer back camera for AR
          } 
        });
        setWebcamStream(stream);
        setWebcamError(null);
        
        // Set up video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // Wait for video to load before enabling AR mode
          const onVideoLoaded = () => {
            console.log('Video loaded, setting up AR mode');
            setArMode(true);
            
            // Update render system to AR mode
            if (renderSystemRef.current) {
              renderSystemRef.current.setARMode(true);
            }
            
            // Remove event listener
            videoRef.current?.removeEventListener('loadeddata', onVideoLoaded);
          };
          
          videoRef.current.addEventListener('loadeddata', onVideoLoaded);
        }
      } catch (error) {
        console.error('Failed to access webcam:', error);
        setWebcamError('Failed to access camera. Please check permissions.');
      }
    } else {
      // Exiting AR mode - stop webcam
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        setWebcamStream(null);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setArMode(false);
      setWebcamError(null);
      
      // Update render system to normal mode
      if (renderSystemRef.current) {
        renderSystemRef.current.setARMode(false);
      }
      
      // Clear AR objects when exiting AR mode
      if (arDetectorRef.current) {
        arDetectorRef.current.clearARObjects();
      }
    }
  };
  
  // Start streaming
  const startStreaming = async () => {
    try {
      setStreamingError(null);
      console.log('Starting Agora streaming...');
      
      // Create Agora client
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
      rtcClientRef.current = client;
      
      // Set up client events
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        console.log(`Subscribed to ${mediaType} from user ${user.uid}`);
        setRemoteUsers(prev => new Map(prev.set(user.uid as number, user)));
      });
      
      client.on('user-unpublished', (user) => {
        console.log(`User ${user.uid} unpublished`);
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(user.uid as number);
          return newMap;
        });
      });
      
      client.on('user-left', (user) => {
        console.log(`User ${user.uid} left`);
        setRemoteUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(user.uid as number);
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
      console.log(`Joined channel ${session.id} with UID ${uid}`);
      
      // Create and publish local tracks
      const [videoTrack, audioTrack] = await Promise.all([
        AgoraRTC.createCameraVideoTrack({
          encoderConfig: {
            width: 1280,
            height: 720,
            frameRate: 30,
            bitrateMax: 2000,
            bitrateMin: 1000,
          },
        }),
        AgoraRTC.createMicrophoneAudioTrack()
      ]);
      
      localVideoTrackRef.current = videoTrack;
      localAudioTrackRef.current = audioTrack;
      
      // Play local video
      if (localVideoRef.current) {
        videoTrack.play(localVideoRef.current);
      }
      
      // Publish tracks
      await client.publish([videoTrack, audioTrack]);
      console.log('Published local tracks');
      
      setIsStreaming(true);
    } catch (error) {
      console.error('Error starting stream:', error);
      setStreamingError(`Failed to start stream: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Stop streaming
  const stopStreaming = async () => {
    try {
      if (rtcClientRef.current) {
        // Unpublish tracks
        if (localVideoTrackRef.current && localAudioTrackRef.current) {
          await rtcClientRef.current.unpublish([localVideoTrackRef.current, localAudioTrackRef.current]);
        }
        
        // Close tracks
        localVideoTrackRef.current?.close();
        localAudioTrackRef.current?.close();
        
        // Leave channel
        await rtcClientRef.current.leave();
        
        // Clear refs
        rtcClientRef.current = null;
        localVideoTrackRef.current = null;
        localAudioTrackRef.current = null;
      }
      
      setIsStreaming(false);
      setLocalUid(null);
      setRemoteUsers(new Map());
      console.log('Stopped streaming');
    } catch (error) {
      console.error('Error stopping stream:', error);
    }
  };
  
  useEffect(() => {
    // Prevent double initialization during React Strict Mode
    if (initializationInProgressRef.current || cleanupInProgressRef.current) {
      console.log('Initialization already in progress or cleanup running, skipping');
      return;
    }
    
    if (!canvasRef.current) {
      console.log('No canvas ref, skipping initialization');
      return;
    }
    
    initializationInProgressRef.current = true;
    console.log('Initializing game systems...');
    
    // Create systems
    const physicsSystem = new GamePhysicsSystem();
    const renderSystem = new GameRenderSystem();
    const inputController = new InputController();
    const arDetector = new EnhancedARDetector((message) => {
      console.log(`[AR] ${message}`);
    });

    // Store refs
    physicsSystemRef.current = physicsSystem;
    renderSystemRef.current = renderSystem;
    inputControllerRef.current = inputController;
    arDetectorRef.current = arDetector;

    // Initialize physics system
    const initGame = async () => {
      try {
        // Check if cleanup started during async initialization
        if (cleanupInProgressRef.current) {
          console.log('Cleanup started during initialization, aborting');
          return;
        }
        
        // Initialize physics
        await physicsSystem.initialize();
        
        // Check again after async operation
        if (cleanupInProgressRef.current) {
          console.log('Cleanup started after physics init, aborting');
          return;
        }
        
        // Initialize renderer
        renderSystem.initialize(canvasRef.current!);
        
        // Initialize AR detector with scene and camera for 3D rendering
        const scene = renderSystem.getScene();
        const camera = renderSystem.getCamera();
        await arDetector.initialize(scene || undefined, camera || undefined);
        
        // Initialize input controller
        inputController.initialize(canvasRef.current!, setKeys);
          
        // Create game loop
        const gameLoop = new GameLoop(physicsSystem, renderSystem, inputController);
        gameLoopRef.current = gameLoop;
        
        // Final cleanup check before starting
        if (cleanupInProgressRef.current) {
          console.log('Cleanup started before game loop start, aborting');
          gameLoop.dispose();
          return;
        }
        
        // Start game loop
        gameLoop.start(setGameState);
        
        initializationInProgressRef.current = false;
        console.log('Game initialized successfully');
      } catch (error) {
        console.error('Error initializing game:', error);
        initializationInProgressRef.current = false;
      }
    };
    
    initGame();

    // Handle window resize
    const handleResize = () => {
      if (renderSystemRef.current && !cleanupInProgressRef.current) {
        renderSystemRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Cleanup function with proper sequencing
    return () => {
      // Set cleanup flag to prevent race conditions
      cleanupInProgressRef.current = true;
      console.log('Starting cleanup of game systems...');
      window.removeEventListener('resize', handleResize);
      
      // Stop webcam stream if active
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
      
      // Stop streaming
      stopStreaming();
      
      // STEP 1: Stop and dispose game loop first (this prevents further system access)
      if (gameLoopRef.current) {
        console.log('Disposing game loop...');
        gameLoopRef.current.dispose();
        gameLoopRef.current = null;
      }
      
      // STEP 2: Dispose input controller (no dependencies)
      if (inputControllerRef.current) {
        console.log('Disposing input controller...');
        inputControllerRef.current.dispose();
        inputControllerRef.current = null;
      }
      
      // STEP 3: Dispose render system (may reference physics for ground sync)
      if (renderSystemRef.current) {
        console.log('Disposing render system...');
        renderSystemRef.current.dispose();
        renderSystemRef.current = null;
      }
      
      // STEP 4: Dispose physics system last (other systems may depend on it)
      if (physicsSystemRef.current) {
        console.log('Disposing physics system...');
        physicsSystemRef.current.dispose();
        physicsSystemRef.current = null;
      }
      
      // STEP 5: Dispose AR detector
      if (arDetectorRef.current) {
        console.log('Disposing AR detector...');
        arDetectorRef.current.dispose();
        arDetectorRef.current = null;
      }
      
      // Reset flags
      initializationInProgressRef.current = false;
      cleanupInProgressRef.current = false;
      console.log('Game systems cleanup completed');
    };
  }, [webcamStream]);

  // AR Detection Loop
  useEffect(() => {
    if (!arMode || !videoRef.current || !arDetectorRef.current) {
      setDetectedMarkers([]);
      return;
    }

    // Set the rendering context for the AR detector when AR mode is enabled
    if (renderSystemRef.current) {
      const scene = renderSystemRef.current.getScene();
      const camera = renderSystemRef.current.getCamera();
      if (scene && camera) {
        arDetectorRef.current.setRenderingContext(scene, camera);
      }
    }

    let detectionAnimationFrame: number;
    
    const runDetection = () => {
      if (arDetectorRef.current && videoRef.current && arMode) {
        const markers = arDetectorRef.current.detectMarkers(videoRef.current);
        // Only log when markers are detected to reduce spam
        if (markers.length > 0) {
          console.log('AR Detection:', markers.length, 'markers found');
        }
        setDetectedMarkers(markers);
        
        // Update debug markers if debug visualization is enabled
        if (debugMarkersEnabled && renderSystemRef.current) {
          renderSystemRef.current.updateARMarkers(markers);
        }
      }
      
      if (arMode) {
        detectionAnimationFrame = requestAnimationFrame(runDetection);
      }
    };
    
    // Start detection loop
    detectionAnimationFrame = requestAnimationFrame(runDetection);
    
    return () => {
      if (detectionAnimationFrame) {
        cancelAnimationFrame(detectionAnimationFrame);
      }
    };
  }, [arMode, debugMarkersEnabled]);

  return (
    <div className="w-full h-screen bg-[#0B0B1A] relative overflow-hidden flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#0B0B1A]/80 to-[#0B0B1A]"/>
      
      {/* Header */}
      <div className="relative z-20 bg-gradient-to-r from-game-900/50 via-game-800/50 to-game-900/50 backdrop-blur-sm border-b border-white/5 p-4">
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
              <p className="text-sm text-white/70">AR Racing Stream</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Streaming Status */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isStreaming ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-white/90 text-sm">
                {isStreaming ? 'Broadcasting' : 'Offline'}
              </span>
            </div>
            
            {/* Viewers Count */}
            {isStreaming && (
              <div className="text-white/70 text-sm">
                {remoteUsers.size} Viewer{remoteUsers.size !== 1 ? 's' : ''}
              </div>
            )}
            
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
          </div>
        </div>
        
        {/* Error Messages */}
        {streamingError && (
          <div className="mt-2 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
            {streamingError}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 relative">
        {/* Video element for webcam feed - positioned behind canvas in AR mode */}
        <video 
          ref={videoRef}
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: 1, // Behind canvas
            display: arMode ? 'block' : 'none', // Only show in AR mode
            transform: 'scaleX(-1)' // Fix mirroring - flip horizontally
          }}
          autoPlay
          playsInline
          muted
        />
        
        <canvas 
          ref={canvasRef} 
          className={`${arMode ? 'relative z-2 bg-transparent' : 'relative z-2'} w-full h-full`}
          tabIndex={0} 
          style={{
            position: 'relative',
            zIndex: 2, // Above video
            display: debugHideCanvas ? 'none' : 'block',
            background: arMode ? 'transparent' : undefined
          }}
        />
        
        {/* Local video preview for streaming (small corner preview) */}
        {isStreaming && (
          <video
            ref={localVideoRef}
            className="absolute bottom-4 right-4 w-48 h-36 bg-black rounded-lg border-2 border-white/20 z-30"
            autoPlay
            playsInline
            muted
            style={{ transform: 'scaleX(-1)' }}
          />
        )}
        
        {/* Game HUD */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="pointer-events-auto">
            <GameHUD 
              gameState={gameState} 
              keysState={keys}
              arMode={arMode}
              onToggleAR={toggleARMode}
              webcamError={webcamError}
              debugHideCanvas={debugHideCanvas}
              onToggleDebugCanvas={() => setDebugHideCanvas(!debugHideCanvas)}
              detectedMarkers={detectedMarkers}
              debugMarkersEnabled={debugMarkersEnabled}
              onToggleDebugMarkers={toggleDebugMarkers}
            />
          </div>
        </div>

        {/* Stream Info Overlay */}
        {isStreaming && (
          <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Broadcasting Live</span>
            </div>
            <div className="text-xs text-white/70">
              Channel: {session.id}<br />
              UID: {localUid}<br />
              Viewers: {remoteUsers.size}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 