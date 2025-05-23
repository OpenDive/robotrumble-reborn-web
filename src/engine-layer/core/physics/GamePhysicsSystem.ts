import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export class GamePhysicsSystem {
  private world: RAPIER.World | null = null;
  private playerBody: RAPIER.RigidBody | null = null;
  private groundCollider: RAPIER.Collider | null = null;
  private cleanup = false;
  private groundSize = 500; // Match the size in RenderSystem

  async initialize(): Promise<void> {
    await RAPIER.init();
    
    if (this.cleanup) return;
    
    // Create physics world
    this.world = new RAPIER.World({x: 0.0, y: -9.81, z: 0.0});
    
    // Create ground collider
    this.createGroundCollider();
    
    // Create walls
    const wallColliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 10.0);
    
    // Left wall
    wallColliderDesc.setTranslation(-5, 0.5, 0);
    this.world.createCollider(wallColliderDesc);
    
    // Right wall
    wallColliderDesc.setTranslation(5, 0.5, 0);
    this.world.createCollider(wallColliderDesc);
    
    // Create player rigid body
    const playerBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 1, 0)
      .setLinearDamping(3.0)
      .setAngularDamping(0.5);
    
    this.playerBody = this.world.createRigidBody(playerBodyDesc);
    
    // Create player collider (capsule for better movement)
    const playerColliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.2); // height, radius
    this.world.createCollider(playerColliderDesc, this.playerBody);
    
    // Lock rotation except around Y axis
    this.playerBody.setEnabledRotations(false, true, false, true);
  }

  // Create the ground collider
  private createGroundCollider(offsetX: number = 0, offsetZ: number = 0): void {
    if (!this.world) return;
    
    // Remove existing ground collider if it exists
    if (this.groundCollider && this.world) {
      this.world.removeCollider(this.groundCollider, true);
      this.groundCollider = null;
    }
    
    // Create new ground collider
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(
      this.groundSize / 2, // half-width in x
      0.1,                 // half-height in y
      this.groundSize / 2  // half-depth in z
    );
    
    // Apply offset if provided
    groundColliderDesc.setTranslation(offsetX, -0.1, offsetZ);
    
    // Create the collider
    this.groundCollider = this.world.createCollider(groundColliderDesc);
  }

  // Method to reposition the ground physics collider
  repositionGround(x: number, z: number): void {
    this.createGroundCollider(x, z);
  }

  getPlayerBody(): RAPIER.RigidBody | null {
    return this.playerBody;
  }

  getWorld(): RAPIER.World | null {
    return this.world;
  }

  step(): void {
    this.safeWorldStep(this.world);
  }

  dispose(): void {
    this.cleanup = true;
    if (this.world) {
      try {
        // First set the current player body reference to null
        this.playerBody = null;
        this.groundCollider = null;
        
        // Safely remove and free all colliders
        if (this.world.colliders) {
          try {
            this.world.forEachCollider(collider => {
              if (collider && this.world) {
                try {
                  this.world.removeCollider(collider, true);
                } catch (e) {
                  console.error("Error removing collider:", e);
                }
              }
            });
          } catch (e) {
            console.error("Error iterating colliders:", e);
          }
        }
        
        // Safely remove and free all rigid bodies
        if (this.world.bodies) {
          try {
            this.world.forEachRigidBody(body => {
              if (body && this.world) {
                try {
                  this.world.removeRigidBody(body);
                } catch (e) {
                  console.error("Error removing rigid body:", e);
                }
              }
            });
          } catch (e) {
            console.error("Error iterating rigid bodies:", e);
          }
        }
        
        // Free the world
        this.world.free();
        this.world = null;
      } catch (e) {
        console.error("Error cleaning up physics world:", e);
      }
    }
  }

  // Safe helper methods
  safeGetTranslation(body: RAPIER.RigidBody | null): { x: number, y: number, z: number } {
    try {
      if (!body) return { x: 0, y: 0, z: 0 };
      const translation = body.translation();
      return { 
        x: translation.x, 
        y: translation.y, 
        z: translation.z 
      };
    } catch (e) {
      console.error("Error getting translation:", e);
      return { x: 0, y: 0, z: 0 };
    }
  }

  safeGetLinvel(body: RAPIER.RigidBody | null): { x: number, y: number, z: number } {
    try {
      if (!body) return { x: 0, y: 0, z: 0 };
      const linvel = body.linvel();
      return { 
        x: linvel.x, 
        y: linvel.y, 
        z: linvel.z 
      };
    } catch (e) {
      console.error("Error getting linear velocity:", e);
      return { x: 0, y: 0, z: 0 };
    }
  }

  safeSetLinvel(
    body: RAPIER.RigidBody | null, 
    velocity: { x: number, y: number, z: number }, 
    wake: boolean
  ): void {
    try {
      if (!body) return;
      body.setLinvel(velocity, wake);
    } catch (e) {
      console.error("Error setting linear velocity:", e);
    }
  }

  safeCastRay(
    origin: { x: number, y: number, z: number },
    direction: { x: number, y: number, z: number },
    maxToi: number,
    solid: boolean
  ): RAPIER.RayColliderHit | null {
    try {
      if (!this.world) return null;
      const ray = new RAPIER.Ray(origin, direction);
      return this.world.castRay(ray, maxToi, solid);
    } catch (e) {
      console.error("Error casting ray:", e);
      return null;
    }
  }

  private safeWorldStep(world: RAPIER.World | null): void {
    try {
      if (!world) return;
      world.step();
    } catch (e) {
      console.error("Error stepping world:", e);
    }
  }
} 