import * as THREE from 'three';
import { ParticleSystem, ParticleData } from '../particles/ParticleSystem';

export class SmokeEffect {
  private particleSystem: ParticleSystem;

  constructor(scene: THREE.Scene) {
    this.particleSystem = new ParticleSystem(scene, {
      maxParticles: 200,
      particleSize: 0.03,
      transparent: true,
      depthWrite: false
    });
  }

  emit(position: THREE.Vector3): void {
    for (let i = 0; i < 50; i++) {
      const particle: ParticleData = {
        position: position.clone().add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
          )
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          Math.random() * 0.02,
          (Math.random() - 0.5) * 0.01
        ),
        life: 1.0,
        maxLife: 1.0 + Math.random(),
        size: 0.02 + Math.random() * 0.02
      };
      this.particleSystem.addParticle(particle);
    }
  }

  update(deltaTime: number): void {
    this.particleSystem.update(deltaTime);
  }

  dispose(): void {
    this.particleSystem.dispose();
  }
}
