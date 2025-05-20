import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import { EffectConfig } from './EffectConfig';

export class BoostTrailEffect extends BaseEffect {
  private baseVelocity: THREE.Vector3;
  private intensity: number;

  constructor(scene: THREE.Scene) {
    const config: EffectConfig = {
      // Particle system settings
      maxParticles: 150,
      particleSize: 0.3,
      emitRate: 60,
      
      // Particle properties
      startSize: [0.2, 0.3],
      endSize: [0.4, 0.5],
      lifetime: [0.5, 0.8],
      
      // Colors - cyan/blue energy core to white-blue edges
      startColor: [new THREE.Color(0x00ffff), new THREE.Color(0x0088ff)],
      endColor: [new THREE.Color(0x88ffff), new THREE.Color(0xffffff)],
      
      // Emission shape
      emitShape: 'cone',
      emitShapeParams: {
        angle: Math.PI / 12,  // 15 degrees
        radius: 0.1
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
  }

  // Override particle generation to incorporate vehicle velocity
  protected generateParticle(position: THREE.Vector3): any {
    const particle = super.generateParticle(position);
    
    // Add base velocity to particle velocity
    particle.velocity.add(this.baseVelocity.clone().multiplyScalar(0.8));
    
    // Scale particle properties by intensity
    particle.size *= this.intensity;
    particle.startSize *= this.intensity;
    particle.endSize *= this.intensity;
    
    return particle;
  }

  // Set the base velocity (from vehicle movement)
  setVelocityBase(velocity: THREE.Vector3): void {
    this.baseVelocity.copy(velocity);
  }

  // Set boost intensity (0.0 to 1.0)
  setIntensity(intensity: number): void {
    this.intensity = THREE.MathUtils.clamp(intensity, 0.0, 1.0);
  }
}
