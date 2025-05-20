import * as THREE from 'three';
import { SmokeEffect } from './templates/SmokeEffect';
import { ExplosionEffect } from './templates/ExplosionEffect';

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

    // Set up keyboard controls for testing
    document.addEventListener('keydown', (event) => {
      if (!this.scene) return;

      const cameraPosition = new THREE.Vector3(0, 0, 2);  // 2 units in front of camera
      switch (event.key.toLowerCase()) {
        case 's':
          this.emitSmoke(cameraPosition);
          break;
        case 'e':
          this.emitExplosion(cameraPosition);
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
