import * as THREE from 'three';
import { SpeedLineSystem } from '../particles/SpeedLineSystem';
import { BaseEffect } from './BaseEffect';
import { EffectConfig } from './EffectConfig';

export class BoostTrailEffect extends BaseEffect {
  private speedLines: SpeedLineSystem;
  private spread: number = 0.8;  // Base spread for V formation in view space
  private lastEmitTime: number = 0;
  private emitInterval: number = 0.05;  // Emit every 50ms
  private baseVelocity: THREE.Vector3;
  private intensity: number;

  constructor(scene: THREE.Scene) {
    // Core particle effect for the energy trail
    const config: EffectConfig = {
      // Particle system settings
      maxParticles: 50,
      particleSize: 0.2,
      emitRate: 30,
      
      // Particle properties
      startSize: [0.1, 0.15],
      endSize: [0.2, 0.3],
      lifetime: [0.3, 0.5],
      
      // Colors - yellow/red energy core
      startColor: [new THREE.Color(0xffff00), new THREE.Color(0xff8800)],
      endColor: [new THREE.Color(0xff4400), new THREE.Color(0xff0000)],
      
      // Emission shape - tight cone for core effect
      emitShape: 'cone',
      emitShapeParams: {
        angle: Math.PI / 24,  // 7.5 degrees
        radius: 0.05
      },
      
      // Physics
      startSpeed: [3.0, 4.0],
      drag: 0.8,
      turbulence: 0.2,
      gravity: new THREE.Vector3(0, 0, 0),

      // Blending for energy effect
      blending: THREE.AdditiveBlending,
      transparent: true
    };

    super(scene, config);
    this.baseVelocity = new THREE.Vector3(0, 0, 0);
    this.intensity = 1.0;

    // Initialize speed line system
    this.speedLines = new SpeedLineSystem(scene, 50);

    // Initialize with default spread
  }

  // Override particle generation to incorporate vehicle velocity
  emit(position: THREE.Vector3): void {
    super.emit(position);

    // Only emit speed lines at intervals
    const now = performance.now();
    if (now - this.lastEmitTime < this.emitInterval * 1000) return;
    this.lastEmitTime = now;

    // Create V formation with speed lines
    const baseColor = new THREE.Color(0xffff00);  // Base yellow color
    const speed = this.baseVelocity.length();
    
    // Adjust spread based on speed and intensity
    // Calculate spread based on speed and intensity
    // Faster speed = wider spread, higher intensity = more pronounced effect
    // Calculate spread based on speed and intensity
    // More speed = wider spread, higher intensity = more pronounced effect
    const dynamicSpread = this.spread * (1.0 + speed * 0.2) * (0.7 + this.intensity * 0.3);
    
    // Create formation centered at position
    this.speedLines.addFormationLines(
      position,
      // Keep full velocity for better line length
      this.baseVelocity.clone(),
      dynamicSpread,
      baseColor
    );
    
    // Add some variation in color and spread
    // Add variations more frequently for better effect
    if (Math.random() < 0.4) {
      // Smaller vertical variation to keep formation tight
      const variation = Math.random() * 0.1 - 0.05;
      this.speedLines.addFormationLines(
        position.clone().add(new THREE.Vector3(0, variation, 0)),
        this.baseVelocity.clone().multiplyScalar(0.9),
        dynamicSpread * 0.8,
        baseColor.clone().multiplyScalar(0.9)
      );
    }
  }

  update(deltaTime: number): void {
    super.update(deltaTime);
    this.speedLines.update(deltaTime);
  }

  dispose(): void {
    super.dispose();
    this.speedLines.dispose();
  }

  setVelocityBase(velocity: THREE.Vector3): void {
    this.baseVelocity.copy(velocity);
    // Adjust emission interval based on speed
    const speed = velocity.length();
    this.emitInterval = THREE.MathUtils.lerp(0.1, 0.02, speed / 10);
  }

  setIntensity(intensity: number): void {
    this.intensity = THREE.MathUtils.clamp(intensity, 0.0, 1.0);
    // Scale emission interval with intensity
    this.emitInterval *= THREE.MathUtils.lerp(1.5, 1.0, this.intensity);
  }
}
