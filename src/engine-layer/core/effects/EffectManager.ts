import * as THREE from 'three';
import { SmokeEffect } from './templates/SmokeEffect';
import { ExplosionEffect } from './templates/ExplosionEffect';
import { BoostTrailEffect } from './templates/BoostTrailEffect';
import { CheckpointEffect, CheckpointConfig } from './templates/CheckpointEffect';

export class EffectManager {
  private static instance: EffectManager;
  private scene!: THREE.Scene;
  private effects: Map<string, any> = new Map();
  private lastTime: number = performance.now();

  private constructor() {}

  static getInstance(): EffectManager {
    if (!EffectManager.instance) {
      EffectManager.instance = new EffectManager();
    }
    return EffectManager.instance;
  }

  initialize(scene: THREE.Scene): void {
    this.scene = scene;
    this.effects.set('smoke', new SmokeEffect(scene));
    this.effects.set('explosion', new ExplosionEffect(scene));
    this.effects.set('boost', new BoostTrailEffect(scene));
    const checkpointConfig: CheckpointConfig = {
      // Checkpoint-specific properties
      checkpointNumber: 1,
      isFinalLap: false,
      height: 3,
      // Base effect properties
      maxParticles: 50,
      particleSize: 0.2,
      blending: THREE.AdditiveBlending,
      transparent: true,
      emitRate: 10,
      startSize: 0.2,
      endSize: 0,
      lifetime: 0.5,
      startColor: new THREE.Color(0x00ccff),
      endColor: new THREE.Color(0x0066ff),
      emitShape: 'point',
      emitShapeParams: { radius: 0.1 },
      // Required by EffectConfig
      velocityBase: new THREE.Vector3(0, 1, 0),
      velocitySpread: new THREE.Vector3(0.2, 0.2, 0.2),
      positionSpread: new THREE.Vector3(0.1, 0.1, 0.1),
      acceleration: new THREE.Vector3(0, -0.5, 0)
    };
    
    this.effects.set('checkpoint', new CheckpointEffect(scene, checkpointConfig));

    // Set up keyboard controls for testing
    document.addEventListener('keydown', (event) => {
      if (!this.scene) return;

      const testPosition = new THREE.Vector3(0, 0, 2);  // 2 units in front of camera
      const testVelocity = new THREE.Vector3(0, 0, -2);  // Moving towards camera
      switch (event.key.toLowerCase()) {
        case 's':
          this.emitSmoke(testPosition);
          break;
        case 'e':
          this.emitExplosion(testPosition);
          break;
        case 'b':
          this.emitBoostTrail(testPosition, testVelocity, 1.0);
          break;
        case 'c':
          this.emitCheckpoint(testPosition);
          break;
      }
    });
  }

  update(): void {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    for (const effect of this.effects.values()) {
      effect.update(deltaTime);
    }
  }

  emitSmoke(position: THREE.Vector3): void {
    const smoke = this.effects.get('smoke');
    if (smoke) {
      smoke.emit(position);
    }
  }

  emitBoostTrail(position: THREE.Vector3, velocity: THREE.Vector3, intensity: number): void {
    const boost = this.effects.get('boost');
    if (boost instanceof BoostTrailEffect) {
      boost.setVelocityBase(velocity);
      boost.setIntensity(intensity);
      boost.emit(position);
    }
  }

  emitCheckpoint(position: THREE.Vector3): void {
    const effect = this.effects.get('checkpoint') as CheckpointEffect;
    if (effect) {
      effect.activate(position);
    }
  }

  emitExplosion(position: THREE.Vector3): void {
    const explosion = this.effects.get('explosion');
    if (explosion) {
      explosion.emit(position);
    }
  }

  dispose(): void {
    for (const effect of this.effects.values()) {
      effect.dispose();
    }
    this.effects.clear();
  }
}

export const effectManager = EffectManager.getInstance();
