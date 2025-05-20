import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import { EffectConfig } from './EffectConfig';

export class ExplosionEffect extends BaseEffect {
  constructor(scene: THREE.Scene) {
    const config: EffectConfig = {
      // Particle system settings
      maxParticles: 300,
      particleSize: 0.5,  // Much larger for first-person view
      burstCount: 100,    // One-shot burst

      // Particle properties
      startSize: [0.4, 0.6],  // Start larger
      endSize: [0.1, 0.2],    // Shrink as they fade
      lifetime: [0.5, 1.0],   // Quick explosion
      
      // Colors - bright orange/yellow core to red edges
      startColor: [new THREE.Color(0xffff80), new THREE.Color(0xff8000)],  // Yellow to orange
      endColor: [new THREE.Color(0xff2000), new THREE.Color(0x000000)],    // Red to black
      
      // Emission in a sphere
      emitShape: 'sphere',
      emitShapeParams: {
        radius: 0.1  // Initial blast radius
      },
      
      // Physics
      startSpeed: [2.0, 3.0],  // Fast initial burst
      gravity: new THREE.Vector3(0, -1, 0),  // Slight downward pull
      drag: 1.0,    // High air resistance
      turbulence: 0.5,  // Chaotic movement
      
      // Rendering
      blending: THREE.AdditiveBlending,
      transparent: true,
      emitRate: 0  // Not used for burst effects
    };

    super(scene, config);
  }
}
