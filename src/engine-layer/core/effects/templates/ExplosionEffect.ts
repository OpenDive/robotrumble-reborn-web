import * as THREE from 'three';
import { ParticleSystem, ParticleData } from '../particles/ParticleSystem';

export class ExplosionEffect {
  private particleSystem: ParticleSystem;

  constructor(scene: THREE.Scene) {
    this.particleSystem = new ParticleSystem(scene, {
      maxParticles: 300,
      particleSize: 0.04,
      transparent: true,
      depthWrite: false
    });
  }

  emit(position: THREE.Vector3): void {
    for (let i = 0; i < 100; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.05 + Math.random() * 0.05;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        (Math.random() - 0.5) * speed
      );

      const particle: ParticleData = {
        position: position.clone(),
        velocity: velocity,
        life: 1.0,
        maxLife: 0.5 + Math.random() * 0.5,
        size: 0.03 + Math.random() * 0.02
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
