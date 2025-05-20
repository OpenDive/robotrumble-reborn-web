import * as THREE from 'three';
import { SpeedLineSystem } from '../particles/SpeedLineSystem';
import { BaseEffect } from './BaseEffect';
import { EffectConfig } from './EffectConfig';

export class BoostTrailEffect extends BaseEffect {
  private speedLines: SpeedLineSystem;
  private emissionPoints: THREE.Vector3[];
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

    // Set up emission points in V formation
    this.emissionPoints = [
      new THREE.Vector3(-0.2, 0, 0),   // Left
      new THREE.Vector3(0, 0, 0),       // Center
      new THREE.Vector3(0.2, 0, 0),     // Right
      new THREE.Vector3(-0.4, 0, -0.1), // Outer left
      new THREE.Vector3(0.4, 0, -0.1)   // Outer right
    ];
  }

  // Override particle generation to incorporate vehicle velocity
  emit(position: THREE.Vector3): void {
    super.emit(position);

    // Only emit speed lines at intervals
    const now = performance.now();
    if (now - this.lastEmitTime < this.emitInterval * 1000) return;
    this.lastEmitTime = now;

    // Emit from each point in the V formation
    this.emissionPoints.forEach((offset, index) => {
      // Transform offset by vehicle orientation
      const emitPos = position.clone().add(
        offset.clone().applyMatrix4(new THREE.Matrix4().lookAt(
          new THREE.Vector3(),
          this.baseVelocity.clone().normalize(),
          new THREE.Vector3(0, 1, 0)
        ))
      );

      // Calculate speed line properties
      const speed = this.baseVelocity.length();
      const lineVel = this.baseVelocity.clone().multiplyScalar(0.8);
      
      // Add some outward spread based on position
      const spread = offset.clone().normalize().multiplyScalar(speed * 0.2);
      lineVel.add(spread);

      // Create speed line with color based on position
      const color = new THREE.Color();
      if (index === 1) { // Center line
        color.setHex(0xffff00);  // Bright yellow
      } else if (index < 3) { // Inner lines
        color.setHex(0xff8800);  // Orange
      } else { // Outer lines
        color.setHex(0xff4400);  // Red
      }

      this.speedLines.addLine(emitPos, lineVel, color);
    });
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
