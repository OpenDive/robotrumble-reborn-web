import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import { EffectConfig } from './EffectConfig';
import { ParticleSystem } from '../particles/ParticleSystem';
import vertexShader from '../shaders/checkpoint-beam.vert';
import fragmentShader from '../shaders/checkpoint-beam.frag';

export interface CheckpointConfig extends EffectConfig {
  checkpointNumber: number;
  isFinalLap: boolean;
  height: number;
}

export class CheckpointEffect extends BaseEffect {
  private beam: THREE.Mesh;
  private ring: THREE.Mesh;
  private flashParticles: ParticleSystem;
  private beamMaterial: THREE.ShaderMaterial;
  private ringMaterial: THREE.MeshBasicMaterial;
  private isActive: boolean = false;
  private activationTime: number = 0;
  private readonly EFFECT_DURATION: number = 0.5;
  private readonly BEAM_RADIUS: number = 1.5;
  private readonly RING_EXPAND_SPEED: number = 3.0;



  constructor(scene: THREE.Scene, config: CheckpointConfig) {
    super(scene, config);

    // Create beam cylinder
    const beamGeometry = new THREE.CylinderGeometry(
      this.BEAM_RADIUS, // top radius
      this.BEAM_RADIUS, // bottom radius
      config.height,    // height
      16,              // segments
      1,               // height segments
      true             // open-ended
    );

    // Custom shader for holographic beam effect
    this.beamMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        baseColor: { value: config.isFinalLap ? 
          new THREE.Vector3(1.0, 0.8, 0.0) :  // Gold for final lap
          new THREE.Vector3(0.0, 0.8, 1.0)    // Blue for normal checkpoint
        },
        opacity: { value: 0.5 }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide
    });

    this.beam = new THREE.Mesh(beamGeometry, this.beamMaterial);
    scene.add(this.beam);

    // Create expanding ring
    const ringGeometry = new THREE.RingGeometry(
      this.BEAM_RADIUS - 0.1,
      this.BEAM_RADIUS + 0.1,
      32
    );
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: config.isFinalLap ? 0xffd700 : 0x00ccff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide
    });
    this.ring = new THREE.Mesh(ringGeometry, this.ringMaterial);
    this.ring.rotation.x = Math.PI / 2; // Lay flat
    scene.add(this.ring);

    // Setup flash particles
    this.flashParticles = new ParticleSystem(scene, {
      maxParticles: 50,
      particleSize: 0.2,
      blending: THREE.AdditiveBlending,
      transparent: true
    });

    // Hide initially
    this.beam.visible = false;
    this.ring.visible = false;
  }

  activate(position: THREE.Vector3): void {
    this.isActive = true;
    this.activationTime = performance.now() / 1000;
    
    // Position everything
    this.beam.position.copy(position);
    this.ring.position.copy(position);
    
    // Show elements
    this.beam.visible = true;
    this.ring.visible = true;
    
    // Emit flash particles
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * this.BEAM_RADIUS;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * this.RING_EXPAND_SPEED,
        (Math.random() - 0.5) * 2,
        Math.sin(angle) * this.RING_EXPAND_SPEED
      );
      
      const color = new THREE.Color().fromArray(this.beamMaterial.uniforms.baseColor.value.toArray());
      this.flashParticles.addParticle({
        position: new THREE.Vector3(
          position.x + Math.cos(angle) * radius,
          position.y,
          position.z + Math.sin(angle) * radius
        ),
        velocity: velocity,
        color,
        startColor: color,
        endColor: color.clone().multiplyScalar(0.5),
        size: 0.2 + Math.random() * 0.3,
        startSize: 0.2 + Math.random() * 0.3,
        endSize: 0,
        life: 0.5,
        maxLife: 0.5
      });
    }
  }

  update(deltaTime: number): void {
    if (!this.isActive) return;

    const time = performance.now() / 1000;
    const elapsed = time - this.activationTime;

    // Update beam shader
    this.beamMaterial.uniforms.time.value = time;

    if (elapsed < this.EFFECT_DURATION) {
      // Expand ring
      const scale = 1 + (elapsed / this.EFFECT_DURATION) * 2;
      this.ring.scale.set(scale, scale, 1);
      
      // Fade ring
      this.ringMaterial.opacity = Math.max(0, 1 - (elapsed / this.EFFECT_DURATION));
    } else {
      // Hide everything when done
      this.beam.visible = false;
      this.ring.visible = false;
      this.isActive = false;
    }

    // Update particles
    this.flashParticles.update(deltaTime);
  }

  dispose(): void {
    this.beam.geometry.dispose();
    this.beamMaterial.dispose();
    this.ring.geometry.dispose();
    this.ringMaterial.dispose();
    this.flashParticles.dispose();
  }
}
