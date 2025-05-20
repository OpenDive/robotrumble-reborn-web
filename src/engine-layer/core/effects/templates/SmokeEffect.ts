import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import { EffectConfig } from './EffectConfig';

export class SmokeEffect extends BaseEffect {
  constructor(scene: THREE.Scene) {
    const config: EffectConfig = {
      // Particle system settings
      maxParticles: 200,
      particleSize: 0.5,  // Much larger for first-person view
      emitRate: 50,  // particles per second

      // Particle properties
      startSize: [0.3, 0.5],  // Larger size range
      endSize: [0.8, 1.2],    // Expand as it dissipates
      lifetime: [1.5, 2.5],    // Longer lifetime
      
      // Colors - gray smoke that fades to transparent
      startColor: new THREE.Color(0x888888),
      endColor: new THREE.Color(0x444444),
      
      // Emission in a cone shape
      emitShape: 'cone',
      emitShapeParams: {
        radius: 0.2,  // Base radius of cone
        angle: Math.PI / 6  // 30 degree spread
      },
      
      // Physics
      startSpeed: [0.5, 1.0],  // Faster initial velocity
      gravity: new THREE.Vector3(0, 0.5, 0),  // Upward drift
      drag: 0.5,  // Air resistance
      turbulence: 0.2,  // Random movement
      
      // Rendering
      blending: THREE.AdditiveBlending,
      transparent: true
    };

    super(scene, config);
  }
}
