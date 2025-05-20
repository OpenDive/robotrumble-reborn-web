import * as THREE from 'three';

export interface EffectConfig {
  // Particle system settings
  maxParticles: number;
  particleSize: number;
  emitRate: number;  // particles per second
  burstCount?: number; // for one-shot effects

  // Particle properties
  startSize: number | [number, number];  // Single value or [min, max]
  endSize: number | [number, number];
  lifetime: number | [number, number];
  
  // Colors
  startColor: THREE.Color | [THREE.Color, THREE.Color];  // Single color or [min, max]
  endColor: THREE.Color | [THREE.Color, THREE.Color];
  
  // Emission shape
  emitShape: 'point' | 'sphere' | 'cone' | 'box';
  emitShapeParams: {
    radius?: number;
    angle?: number;
    size?: THREE.Vector3;
  };
  
  // Physics
  startSpeed: number | [number, number];
  gravity: THREE.Vector3;
  drag: number;  // Air resistance
  turbulence?: number;  // Random forces
  
  // Rendering
  blending: THREE.Blending;
  transparent: boolean;
  texture?: THREE.Texture;
}
