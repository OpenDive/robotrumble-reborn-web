import * as THREE from 'three';
import { ParticleSystem, ParticleData } from '../particles/ParticleSystem';
import { EffectConfig } from './EffectConfig';

export class BaseEffect {
  protected particleSystem: ParticleSystem;
  protected config: EffectConfig;
  protected emitAccumulator: number = 0;
  protected canEmit: boolean = true;
  protected hasActiveParticles: boolean = false;

  constructor(scene: THREE.Scene, config: EffectConfig) {
    this.config = config;
    this.particleSystem = new ParticleSystem(scene, {
      maxParticles: config.maxParticles,
      particleSize: config.particleSize,
      blending: config.blending,
      transparent: config.transparent,
      texture: config.texture
    });
  }

  protected getRandomInRange(value: number | [number, number]): number {
    if (Array.isArray(value)) {
      return value[0] + Math.random() * (value[1] - value[0]);
    }
    return value;
  }

  protected getRandomColor(color: THREE.Color | [THREE.Color, THREE.Color]): THREE.Color {
    if (Array.isArray(color)) {
      const t = Math.random();
      return new THREE.Color().lerpColors(color[0], color[1], t);
    }
    return color;
  }

  protected generateEmissionPosition(basePosition: THREE.Vector3): THREE.Vector3 {
    const pos = basePosition.clone();
    const params = this.config.emitShapeParams;

    switch (this.config.emitShape) {
      case 'sphere': {
        const radius = params.radius || 1;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        pos.x += radius * Math.sin(phi) * Math.cos(theta);
        pos.y += radius * Math.sin(phi) * Math.sin(theta);
        pos.z += radius * Math.cos(phi);
        break;
      }
      case 'cone': {
        const radius = params.radius || 1;
        const angle = params.angle || Math.PI / 4;
        const theta = Math.random() * Math.PI * 2;
        const r = radius * Math.random();
        pos.x += r * Math.cos(theta);
        pos.y += r * Math.sin(theta);
        pos.z += r * Math.tan(angle);
        break;
      }
      case 'box': {
        const size = params.size || new THREE.Vector3(1, 1, 1);
        pos.x += (Math.random() - 0.5) * size.x;
        pos.y += (Math.random() - 0.5) * size.y;
        pos.z += (Math.random() - 0.5) * size.z;
        break;
      }
    }
    return pos;
  }

  protected generateParticle(position: THREE.Vector3): ParticleData {
    const startSpeed = this.getRandomInRange(this.config.startSpeed);
    const direction = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize();

    return {
      position: this.generateEmissionPosition(position),
      velocity: direction.multiplyScalar(startSpeed),
      life: this.getRandomInRange(this.config.lifetime),
      maxLife: this.getRandomInRange(this.config.lifetime),
      size: this.getRandomInRange(this.config.startSize),
      // Store additional properties for interpolation
      startColor: this.getRandomColor(this.config.startColor),
      endColor: this.getRandomColor(this.config.endColor),
      startSize: this.getRandomInRange(this.config.startSize),
      endSize: this.getRandomInRange(this.config.endSize)
    };
  }

  emit(position: THREE.Vector3): void {
    if (!this.canEmit) return;

    if (this.config.burstCount) {
      // One-shot burst emission
      for (let i = 0; i < this.config.burstCount; i++) {
        this.particleSystem.addParticle(this.generateParticle(position));
      }
      this.canEmit = false;  // Prevent new bursts
      this.hasActiveParticles = true;
    } else {
      // Continuous emission based on emitRate
      const particlesToEmit = Math.floor(this.emitAccumulator);
      for (let i = 0; i < particlesToEmit; i++) {
        this.particleSystem.addParticle(this.generateParticle(position));
      }
      this.emitAccumulator -= particlesToEmit;
    }
  }

  update(deltaTime: number): void {
    // For burst effects, only update if we have particles
    if (this.config.burstCount && !this.hasActiveParticles) return;

    // For continuous effects, accumulate emission time
    if (!this.config.burstCount && this.canEmit) {
      this.emitAccumulator += this.config.emitRate * deltaTime;
    }

    // Update physics
    const gravity = this.config.gravity;
    const drag = this.config.drag;
    const turbulence = this.config.turbulence || 0;

    let activeCount = 0;
    this.particleSystem.updateWithPhysics(deltaTime, (particle) => {
      if (particle.life > 0) activeCount++;
      // Apply gravity
      particle.velocity.add(gravity.clone().multiplyScalar(deltaTime));
      
      // Apply drag
      particle.velocity.multiplyScalar(1 - drag * deltaTime);
      
      // Apply turbulence
      if (turbulence > 0) {
        particle.velocity.add(new THREE.Vector3(
          (Math.random() - 0.5) * turbulence,
          (Math.random() - 0.5) * turbulence,
          (Math.random() - 0.5) * turbulence
        ).multiplyScalar(deltaTime));
      }

      // Interpolate size and color based on lifetime
      const t = 1 - (particle.life / particle.maxLife);
      particle.size = THREE.MathUtils.lerp(particle.startSize, particle.endSize, t);
      particle.color = new THREE.Color().lerpColors(particle.startColor, particle.endColor, t);
    });

    // Update active state based on particle count
    this.hasActiveParticles = activeCount > 0;
  }

  dispose(): void {
    this.particleSystem.dispose();
  }

  reset(): void {
    this.canEmit = true;
    // Don't reset hasActiveParticles - let it be controlled by particle count
  }
}
