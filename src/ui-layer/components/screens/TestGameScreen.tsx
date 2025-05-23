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
    if (!canvasRef.current) {
      console.log('No canvas ref, skipping initialization');
      return;
    }
    
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
        // Initialize physics
        await physicsSystem.initialize();
        
        // Initialize renderer
        renderSystem.initialize(canvasRef.current!);
        
        // Initialize input controller
        inputController.initialize(canvasRef.current!, setKeys);
        
        // Create game loop
        const gameLoop = new GameLoop(physicsSystem, renderSystem, inputController);
        gameLoopRef.current = gameLoop;
        
        // Start game loop
        gameLoop.start(setGameState);
        
        console.log('Game initialized successfully');
      } catch (error) {
        console.error('Error initializing game:', error);
      }
    };
    
    initGame();
    
    // Handle window resize
    const handleResize = () => {
      if (renderSystemRef.current) {
        renderSystemRef.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      console.log('Cleaning up game systems...');
      window.removeEventListener('resize', handleResize);
      
      // Stop game loop
      if (gameLoopRef.current) {
        gameLoopRef.current.stop();
        gameLoopRef.current = null;
      }
      
      // Dispose input controller
      if (inputControllerRef.current) {
        inputControllerRef.current.dispose();
        inputControllerRef.current = null;
      }
      
      // Dispose render system
      if (renderSystemRef.current) {
        renderSystemRef.current.dispose();
        renderSystemRef.current = null;
      }
      
      // Dispose physics system
      if (physicsSystemRef.current) {
        physicsSystemRef.current.dispose();
        physicsSystemRef.current = null;
      }
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
