import * as THREE from 'three';

export interface ParticleData {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  startSize: number;
  endSize: number;
  startColor: THREE.Color;
  endColor: THREE.Color;
  color?: THREE.Color;  // Current interpolated color
}

export interface ParticleSystemOptions {
  maxParticles?: number;
  particleSize?: number;
  blending?: THREE.Blending;
  transparent?: boolean;
  depthWrite?: boolean;
  texture?: THREE.Texture;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private points: THREE.Points;
  private particles: ParticleData[] = [];
  private maxParticles: number;

  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;

  constructor(scene: THREE.Scene, options: ParticleSystemOptions = {}) {
    this.scene = scene;
    this.maxParticles = options.maxParticles || 1000;

    // Initialize geometry with buffers
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // Create material with default options
    this.material = new THREE.PointsMaterial({
      size: options.particleSize || 0.02,
      vertexColors: true,
      blending: options.blending || THREE.AdditiveBlending,
      transparent: options.transparent !== undefined ? options.transparent : true,
      depthWrite: options.depthWrite !== undefined ? options.depthWrite : false,
      map: options.texture || this.createDefaultParticleTexture()
    });

    // Create points system
    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);
  }

  private createDefaultParticleTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    // Create radial gradient
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  addParticle(particle: ParticleData): void {
    if (this.particles.length < this.maxParticles) {
      this.particles.push(particle);
    }
  }

  updateWithPhysics(deltaTime: number, physicsCallback: (particle: ParticleData) => void): void {
    // Update particle physics
    this.particles = this.particles.filter(particle => {
      particle.life -= deltaTime;
      if (particle.life <= 0) return false;

      // Apply custom physics
      physicsCallback(particle);
      
      // Update position based on velocity
      particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
      return true;
    });

    // Update geometry
    const positions = this.geometry.attributes.position.array as Float32Array;
    const colors = this.geometry.attributes.color.array as Float32Array;
    const sizes = this.geometry.attributes.size.array as Float32Array;

    // Reset arrays
    positions.fill(0);
    colors.fill(0);
    sizes.fill(0);

    // Update particles
    this.particles.forEach((particle, i) => {
      const i3 = i * 3;
      positions[i3] = particle.position.x;
      positions[i3 + 1] = particle.position.y;
      positions[i3 + 2] = particle.position.z;

      // Use interpolated color if available, otherwise use alpha
      if (particle.color) {
        colors[i3] = particle.color.r;
        colors[i3 + 1] = particle.color.g;
        colors[i3 + 2] = particle.color.b;
      } else {
        const alpha = particle.life / particle.maxLife;
        colors[i3] = alpha;
        colors[i3 + 1] = alpha;
        colors[i3 + 2] = alpha;
      }

      sizes[i] = particle.size;
    });

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }

  // Keep the old update for backward compatibility
  update(deltaTime: number): void {
    this.updateWithPhysics(deltaTime, () => {
      // No custom physics
    });
  }

  dispose(): void {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    if (this.material.map) {
      this.material.map.dispose();
    }
  }
}
