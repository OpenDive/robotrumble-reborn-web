import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import styles from './TestGameScreen.module.css';
import { GamePhysicsSystem } from '../../../engine-layer/core/physics/GamePhysicsSystem';
import { GameRenderSystem } from '../../../engine-layer/core/renderer/GameRenderSystem';
import { InputController } from '../../../engine-layer/core/input/InputController';
import { GameLoop } from '../../../engine-layer/core/game/GameLoop';
import { GameHUD } from '../hud/GameHUD';
import { GameState, KeyState } from '../../../shared/types/GameTypes';

export const TestGameScreen: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // System refs
  const physicsSystemRef = useRef<GamePhysicsSystem | null>(null);
  const renderSystemRef = useRef<GameRenderSystem | null>(null);
  const inputControllerRef = useRef<InputController | null>(null);
  const gameLoopRef = useRef<GameLoop | null>(null);
  
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

    // Store refs
    physicsSystemRef.current = physicsSystem;
    renderSystemRef.current = renderSystem;
    inputControllerRef.current = inputController;

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
      
      // Reset flags
      initializationInProgressRef.current = false;
      cleanupInProgressRef.current = false;
      console.log('Game systems cleanup completed');
    };
  }, []);

  return (
    <div className={styles.container}>
      <canvas 
        ref={canvasRef} 
        className={styles.canvas} 
        tabIndex={0} 
      />
      
      {/* Game HUD */}
      <div className={styles.hud}>
        <GameHUD gameState={gameState} keysState={keys} />
      </div>
    </div>
  );
};
