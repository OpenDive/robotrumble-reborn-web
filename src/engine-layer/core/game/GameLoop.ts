import * as THREE from 'three';
import { GameState, KeyState } from '../../../shared/types/GameTypes';
import { GamePhysicsSystem } from '../physics/GamePhysicsSystem';
import { GameRenderSystem } from '../renderer/GameRenderSystem';
import { InputController } from '../input/InputController';

export class GameLoop {
  private animationFrameId?: number;
  private lastTime = 0;
  private frameCount = 0;
  private running = false;
  
  private physicsSystem: GamePhysicsSystem;
  private renderSystem: GameRenderSystem;
  private inputController: InputController;
  
  private gameState: GameState = {
    position: new THREE.Vector3(0, 1, 0),
    rotation: 0,
    velocity: new THREE.Vector2(0, 0),
    isColliding: false
  };
  
  private onGameStateUpdate?: (state: GameState) => void;

  constructor(
    physicsSystem: GamePhysicsSystem,
    renderSystem: GameRenderSystem,
    inputController: InputController
  ) {
    this.physicsSystem = physicsSystem;
    this.renderSystem = renderSystem;
    this.inputController = inputController;
  }

  start(onGameStateUpdate?: (state: GameState) => void): void {
    if (this.running) return;
    this.running = true;
    this.onGameStateUpdate = onGameStateUpdate;
    this.lastTime = 0;
    this.frameCount = 0;
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  stop(): void {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
  }

  private animate = (time: number): void => {
    // Request next frame first
    this.animationFrameId = requestAnimationFrame(this.animate);
    
    // Debug animation and physics state every 60 frames
    if (this.frameCount % 60 === 0) {
      console.log('%cFrame:', 'color: #4CAF50; font-weight: bold', {
        number: this.frameCount,
        physics: {
          world: this.physicsSystem.getWorld() ? 'exists' : 'null',
          playerBody: this.physicsSystem.getPlayerBody() ? 'exists' : 'null'
        }
      });
    }
    this.frameCount++;
    
    const deltaTime = (time - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = time;
    
    // Update physics world
    const playerBody = this.physicsSystem.getPlayerBody();
    if (this.physicsSystem.getWorld() && playerBody) {
      // PHASE 1: Gather input and calculate intended movement
      const keys = this.inputController.getKeys();
      
      // Handle rotation first
      let newRotation = this.gameState.rotation;
      const rotationSpeed = 3.0;
      if (keys.left) newRotation += rotationSpeed * deltaTime;
      if (keys.right) newRotation -= rotationSpeed * deltaTime;
      
      // Handle movement
      const speed = 8.0;
      const maxVelocity = 3.0; // Maximum velocity
      const accelerationFactor = 0.2; // How quickly to reach target velocity
      const decelerationFactor = 0.15; // How quickly to slow down (smoother than before)
      const moveDirection = new THREE.Vector3(0, 0, 0);
      
      if (keys.forward) moveDirection.z = -1; // Forward
      if (keys.backward) moveDirection.z = 1;  // Backward
      
      // PHASE 2: Cache current physics state before any modifications
      const currentPos = this.physicsSystem.safeGetTranslation(playerBody);
      const currentVel = this.physicsSystem.safeGetLinvel(playerBody);
      const velocityMagnitude = Math.sqrt(
        currentVel.x * currentVel.x + 
        currentVel.z * currentVel.z
      );
      
      // PHASE 3: Step the physics world once
      this.physicsSystem.step();
      
      // PHASE 4: Update physics body based on input (after stepping)
      // Calculate the new velocity based on input
      let newVelocity = { x: currentVel.x, y: currentVel.y, z: currentVel.z };
      
      if (keys.forward || keys.backward) {
        // Apply rotation to movement vector
        moveDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), newRotation);
        
        // Calculate target velocity
        const targetVelocity = {
          x: moveDirection.x * speed,
          y: 0,
          z: moveDirection.z * speed
        };
        
        // Smoothly interpolate current velocity toward target velocity
        newVelocity = {
          x: currentVel.x + (targetVelocity.x - currentVel.x) * accelerationFactor,
          y: currentVel.y,
          z: currentVel.z + (targetVelocity.z - currentVel.z) * accelerationFactor
        };
        
        // Log movement info
        console.log('%cMovement:', 'color: #FF9800; font-weight: bold', {
          targetVelocity,
          newVelocity,
          rotation: newRotation.toFixed(2),
          keys: JSON.stringify(keys)
        });
      } else {
        // Apply gradual deceleration when no movement keys are pressed
        const targetStopVelocity = { x: 0, y: currentVel.y, z: 0 };
        newVelocity = {
          x: currentVel.x + (targetStopVelocity.x - currentVel.x) * decelerationFactor,
          y: currentVel.y,
          z: currentVel.z + (targetStopVelocity.z - currentVel.z) * decelerationFactor
        };
      }
      
      // Apply velocity clamping
      const newVelocityMagnitude = Math.sqrt(
        newVelocity.x * newVelocity.x + 
        newVelocity.z * newVelocity.z
      );
      
      if (newVelocityMagnitude > maxVelocity) {
        const scaleFactor = maxVelocity / newVelocityMagnitude;
        newVelocity.x *= scaleFactor;
        newVelocity.z *= scaleFactor;
      }
      
      // Set the new velocity
      this.physicsSystem.safeSetLinvel(playerBody, newVelocity, true);
      
      // PHASE 5: Update game state with the new physics state
      // Get the updated position after velocity change
      const newPos = this.physicsSystem.safeGetTranslation(playerBody);
      
      // Check collisions using the cached position
      const radius = 0.5;
      const isColliding = [
        {x: 1, y: 0, z: 0},
        {x: -1, y: 0, z: 0},
        {x: 0, y: 0, z: 1},
        {x: 0, y: 0, z: -1},
      ].some(dir => {
        // Create a new ray for each direction to avoid aliasing
        const rayStart = { x: newPos.x, y: newPos.y, z: newPos.z };
        const hit = this.physicsSystem.safeCastRay(
          rayStart, dir, radius * 2, true
        );
        return hit !== null;
      });
      
      // PHASE 6: Update camera and visuals
      // Update camera position
      this.renderSystem.updateCamera(
        new THREE.Vector3(newPos.x, newPos.y, newPos.z),
        newRotation,
        newVelocityMagnitude
      );
      
      // Update trail visualization
      this.renderSystem.updateTrail(
        new THREE.Vector3(newPos.x, newPos.y, newPos.z)
      );
      
      // Handle collision feedback
      this.renderSystem.handleCollisionFeedback(isColliding);
      
      // Update game state
      this.gameState = {
        position: new THREE.Vector3(newPos.x, newPos.y, newPos.z),
        rotation: newRotation,
        velocity: new THREE.Vector2(newVelocity.x, newVelocity.z),
        isColliding
      };
      
      // Notify the UI about state changes
      if (this.onGameStateUpdate) {
        this.onGameStateUpdate(this.gameState);
      }
    }
    
    // Always render at the end with the final state
    this.renderSystem.render();
  };

  getGameState(): GameState {
    return this.gameState;
  }
} 