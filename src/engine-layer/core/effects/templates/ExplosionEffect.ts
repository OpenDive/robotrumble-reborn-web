import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import { EffectConfig } from './EffectConfig';

export class ExplosionEffect extends BaseEffect {
  emit(position: THREE.Vector3): void {
    this.reset();  // Reset before each explosion
    super.emit(position);
  }

  constructor(scene: THREE.Scene) {
    const config: EffectConfig = {
      // Particle system settings
      maxParticles: 300,
      particleSize: 0.5,  // Much larger for first-person view
      burstCount: 100,    // One-shot burst

      // Particle properties
      startSize: [0.8, 1.2],  // Much larger start size
      endSize: [0.3, 0.5],    // Still visible when fading
      lifetime: [1.0, 1.5],   // Longer lifetime for visibility
      
      // Colors - bright orange/yellow core to red edges
      startColor: [new THREE.Color(0xffff80), new THREE.Color(0xff8000)],  // Yellow to orange
      endColor: [new THREE.Color(0xff2000), new THREE.Color(0x000000)],    // Red to black
      
      // Emission in a sphere
      emitShape: 'sphere',
      emitShapeParams: {
        radius: 0.1  // Initial blast radius
      },
      
      // Physics
      startSpeed: [3.0, 4.0],  // Faster initial burst
      gravity: new THREE.Vector3(0, 0.5, 0),  // Slight upward force for visibility
      drag: 0.5,    // Less air resistance
      turbulence: 1.0,  // More chaotic movement
      
      // Rendering
      blending: THREE.AdditiveBlending,
      transparent: true,
      emitRate: 0  // Not used for burst effects
    };

    super(scene, config);
  }
}
