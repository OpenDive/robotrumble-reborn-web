import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import styles from './TestGameScreen.module.css';
import { GamePhysicsSystem } from '../../../engine-layer/core/physics/GamePhysicsSystem';
import { GameRenderSystem } from '../../../engine-layer/core/renderer/GameRenderSystem';
import { InputController } from '../../../engine-layer/core/input/InputController';
import { GameLoop } from '../../../engine-layer/core/game/GameLoop';
import { GameHUD } from '../hud/GameHUD';
import { GameState, KeyState } from '../../../shared/types/GameTypes';
import { EnhancedARDetector, DetectedMarker } from '../../../engine-layer/core/ar/EnhancedARDetector';

export const TestGameScreen: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // System refs
  const physicsSystemRef = useRef<GamePhysicsSystem | null>(null);
  const renderSystemRef = useRef<GameRenderSystem | null>(null);
  const inputControllerRef = useRef<InputController | null>(null);
  const gameLoopRef = useRef<GameLoop | null>(null);
  const arDetectorRef = useRef<EnhancedARDetector | null>(null);
  
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
  
  // Debug state for testing video visibility
  const [debugHideCanvas, setDebugHideCanvas] = useState(false);
  
  // Debug markers state
  const [debugMarkersEnabled, setDebugMarkersEnabled] = useState(false);
  
  // Debug markers toggle handler
  const toggleDebugMarkers = () => {
    const newEnabled = !debugMarkersEnabled;
    setDebugMarkersEnabled(newEnabled);
    
    if (renderSystemRef.current) {
      renderSystemRef.current.setAREffectsEnabled(newEnabled);
      
      // If enabling debug markers in AR mode, update markers
      if (newEnabled && arMode && detectedMarkers.length > 0) {
        renderSystemRef.current.updateAREffects(detectedMarkers);
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
            
            // Update render system to AR mode (no video element needed for CSS approach)
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
      
      // Update render system to normal mode and remove video element
      if (renderSystemRef.current) {
        renderSystemRef.current.setARMode(false);
      }
      
      // Clear AR objects when exiting AR mode
      if (arDetectorRef.current) {
        arDetectorRef.current.clearARObjects();
      }
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
      
      // STEP 1: Stop and dispose game loop first (this prevents further system access)
      if (gameLoopRef.current) {
        console.log('Disposing game loop...');
        gameLoopRef.current.dispose(); // This will stop the loop and clear references
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
    // EnhancedARDetector handles all 3D AR object management directly
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
        
        // EnhancedARDetector handles all 3D AR object rendering directly
        // Only update debug markers if debug visualization is enabled
        if (debugMarkersEnabled && renderSystemRef.current) {
          renderSystemRef.current.updateAREffects(markers);
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
  }, [arMode]);

  return (
    <div className={styles.container}>
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
        className={`${styles.canvas} ${arMode ? styles.transparent : ''}`}
        tabIndex={0} 
        style={{
          position: 'relative',
          zIndex: 2, // Above video
          display: debugHideCanvas ? 'none' : 'block'
        }}
      />
      
      {/* Game HUD */}
      <div className={styles.hud}>
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
  );
};
