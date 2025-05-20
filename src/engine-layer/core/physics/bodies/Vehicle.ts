import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsObject } from '../PhysicsManager';
import { effectManager } from '../../effects/EffectManager';

export interface VehicleConfig {
  width: number;
  length: number;
  height: number;
  mass: number;
  maxSpeed: number;
  acceleration: number;
  turnSpeed: number;
}

export class Vehicle implements PhysicsObject {
  body: RAPIER.RigidBody;
  mesh: THREE.Object3D;
  private config: VehicleConfig;
  private throttle: number = 0;
  private steering: number = 0;
  private lastSmoke: number = 0;
  private readonly SMOKE_INTERVAL = 100; // ms

  constructor(
    body: RAPIER.RigidBody,
    mesh: THREE.Object3D,
    config: VehicleConfig
  ) {
    this.body = body;
    this.mesh = mesh;
    this.config = config;
  }

  setThrottle(value: number): void {
    this.throttle = THREE.MathUtils.clamp(value, -1, 1);
  }

  setSteering(value: number): void {
    this.steering = THREE.MathUtils.clamp(value, -1, 1);
  }

  update(): void {
    // Update physics body
    const rotation = this.body.rotation();
    const forward = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w));

    // Apply forces
    const force = forward.multiplyScalar(this.throttle * this.config.acceleration);
    this.body.addForce({ x: force.x, y: force.y, z: force.z }, true);

    // Apply torque for steering
    this.body.addTorque({ 
      x: 0,
      y: this.steering * this.config.turnSpeed,
      z: 0
    }, true);

    // Update visual mesh
    const position = this.body.translation();
    this.mesh.position.set(position.x, position.y, position.z);
    
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

    // Emit smoke effect when accelerating
    const now = performance.now();
    if (Math.abs(this.throttle) > 0.5 && now - this.lastSmoke > this.SMOKE_INTERVAL) {
      const smokePosition = this.mesh.position.clone().add(
        new THREE.Vector3(0, 0, -this.config.length / 2)
          .applyQuaternion(this.mesh.quaternion)
      );
      effectManager.emitSmoke(smokePosition);
      this.lastSmoke = now;
    }
  }

  getVelocity(): THREE.Vector3 {
    const linvel = this.body.linvel();
    return new THREE.Vector3(linvel.x, linvel.y, linvel.z);
  }

  getSpeed(): number {
    return this.getVelocity().length();
  }
}
