import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { effectManager } from '../effects/EffectManager';

export interface PhysicsObject {
  body: RAPIER.RigidBody;
  mesh: THREE.Object3D;
  update(): void;
}

export class PhysicsManager {
  private static instance: PhysicsManager;
  private world!: RAPIER.World;
  private objects: Map<number, PhysicsObject> = new Map();
  private eventQueue!: RAPIER.EventQueue;
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): PhysicsManager {
    if (!PhysicsManager.instance) {
      PhysicsManager.instance = new PhysicsManager();
    }
    return PhysicsManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize Rapier
    await RAPIER.init();
    
    // Create physics world
    this.world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
    this.eventQueue = new RAPIER.EventQueue(true);
    
    this.initialized = true;
  }

  createRigidBody(
    position: THREE.Vector3,
    rotation: THREE.Quaternion,
    bodyType: RAPIER.RigidBodyType,
    options: {
      linearDamping?: number;
      angularDamping?: number;
      restitution?: number;
      friction?: number;
    } = {}
  ): RAPIER.RigidBody {
    const rigidBodyDesc = new RAPIER.RigidBodyDesc(bodyType)
      .setTranslation(position.x, position.y, position.z)
      .setRotation(rotation);

    if (options.linearDamping !== undefined) {
      rigidBodyDesc.setLinearDamping(options.linearDamping);
    }
    if (options.angularDamping !== undefined) {
      rigidBodyDesc.setAngularDamping(options.angularDamping);
    }

    const body = this.world.createRigidBody(rigidBodyDesc);

    return body;
  }

  createCollider(
    body: RAPIER.RigidBody,
    shape: RAPIER.ColliderDesc,
    options: {
      restitution?: number;
      friction?: number;
    } = {}
  ): RAPIER.Collider {
    if (options.restitution !== undefined) {
      shape.setRestitution(options.restitution);
    }
    if (options.friction !== undefined) {
      shape.setFriction(options.friction);
    }

    return this.world.createCollider(shape, body);
  }

  registerObject(object: PhysicsObject): void {
    this.objects.set(object.body.handle, object);
  }

  unregisterObject(object: PhysicsObject): void {
    this.objects.delete(object.body.handle);
  }

  update(): void {
    if (!this.initialized) return;

    // Step the physics world with fixed timestep (1/60 second)
    this.world.step();

    // Handle collision events
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (started) {
        const obj1 = this.objects.get(handle1);
        const obj2 = this.objects.get(handle2);
        
        if (obj1 && obj2) {
          const position = new THREE.Vector3();
          if (obj1.mesh && obj2.mesh) {
            position.addVectors(
              obj1.mesh.position,
              obj2.mesh.position
            ).multiplyScalar(0.5);
            
            // Trigger collision effect
            effectManager.emitExplosion(position);
          }
        }
      }
    });

    // Update object transforms
    for (const object of this.objects.values()) {
      object.update();
    }
  }

  dispose(): void {
    if (this.world) {
      this.world.free();
    }
    if (this.eventQueue) {
      this.eventQueue.free();
    }
    this.objects.clear();
    this.initialized = false;
  }
}

export const physicsManager = PhysicsManager.getInstance();
