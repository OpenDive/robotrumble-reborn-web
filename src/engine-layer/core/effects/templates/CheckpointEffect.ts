import * as THREE from 'three';
import { BaseEffect } from './BaseEffect';
import { EffectConfig } from './EffectConfig';
import { ParticleSystem } from '../particles/ParticleSystem';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Font, FontLoader } from 'three/addons/loaders/FontLoader.js';
// @ts-ignore
import vertexShader from './shaders/checkpoint-beam.vert?raw';
// @ts-ignore
import fragmentShader from './shaders/checkpoint-beam.frag?raw';
// @ts-ignore
import numberVertexShader from './shaders/number-glow.vert?raw';
// @ts-ignore
import numberFragmentShader from './shaders/number-glow.frag?raw';

export interface CheckpointConfig extends EffectConfig {
  checkpointNumber: number;
  isFinalLap: boolean;
  height: number;
}

export class CheckpointEffect extends BaseEffect {
  protected scene: THREE.Scene;

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
  private readonly NUMBER_FLOAT_SPEED: number = 1.0;
  private readonly NUMBER_FLOAT_AMPLITUDE: number = 0.1;
  private readonly NUMBER_SCALE: number = 2.0;
  private readonly NUMBER_VERTICAL_OFFSET: number = 0.5;

  private numberDisplay: THREE.Group | null = null;
  private numberMesh: THREE.Mesh | null = null;
  private numberMaterial: THREE.ShaderMaterial | null = null;
  private font: Font | null = null;



  constructor(scene: THREE.Scene, config: CheckpointConfig) {
    super(scene, config);
    this.scene = scene;

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

    // Initialize number display
    const numberDisplay = new THREE.Group();
    scene.add(numberDisplay);
    this.numberDisplay = numberDisplay;

    // Create number material with glow effect
    const numberMaterial = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: config.isFinalLap ? 
          new THREE.Vector3(1.0, 0.8, 0.0) :  // Gold for final lap
          new THREE.Vector3(0.0, 0.8, 1.0)    // Blue for normal checkpoint
        },
        opacity: { value: 1.0 },
        time: { value: 0 }
      },
      vertexShader: numberVertexShader,
      fragmentShader: numberFragmentShader,
      transparent: true,
      side: THREE.DoubleSide
    });

    // Load font and create number mesh
    const fontLoader = new FontLoader();
    const fontPath = '/fonts/helvetiker_bold.typeface.json';
    fontLoader.load(
      fontPath,
      (font: Font) => {
        this.font = font;
        this.createNumberMesh(config.checkpointNumber);
      },
      undefined, // onProgress callback
      (error) => {
        console.error(`Error loading font from ${fontPath}:`, error);
      }
    );

    this.numberMaterial = numberMaterial;

    // Hide initially
    this.beam.visible = false;
    this.ring.visible = false;
    this.numberDisplay.visible = false;
  }

  private createNumberMesh(number: number): void {
    if (!this.font || !this.numberMaterial || !this.numberDisplay) return;

    // Clean up old mesh if it exists
    if (this.numberMesh) {
      this.numberDisplay.remove(this.numberMesh);
      if (this.numberMesh.geometry) {
        this.numberMesh.geometry.dispose();
      }
    }

    // Create text geometry
    const geometry = new TextGeometry(number.toString(), {
      font: this.font,
      size: this.NUMBER_SCALE,
      depth: this.NUMBER_SCALE * 0.1,
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.01,
      bevelOffset: 0,
      bevelSegments: 5
    });

    // Center the geometry
    geometry.computeBoundingBox();
    const centerOffset = new THREE.Vector3();
    if (geometry.boundingBox) {
      geometry.boundingBox.getCenter(centerOffset).multiplyScalar(-1);
    }

    // Create new mesh
    const mesh = new THREE.Mesh(geometry, this.numberMaterial);
    mesh.position.copy(centerOffset);
    
    // Set initial scale and rotation
    mesh.scale.set(1, 1, 1);
    // Rotate to face camera
    mesh.rotation.x = -Math.PI / 6; // Tilt slightly up
    
    // Add to scene
    this.numberDisplay.add(mesh);
    this.numberMesh = mesh;
    
    // Ensure visibility matches parent
    mesh.visible = this.numberDisplay.visible;
  }

  activate(position: THREE.Vector3): void {
    this.isActive = true;
    this.activationTime = performance.now() / 1000;
    
    // Position everything
    this.beam.position.copy(position);
    this.ring.position.copy(position);
    
    if (this.numberDisplay) {
      this.numberDisplay.position.copy(position);
      this.numberDisplay.position.y += this.NUMBER_VERTICAL_OFFSET;
      this.numberDisplay.visible = true;
      if (this.numberMesh) {
        this.numberMesh.visible = true;
      }
    }
    
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
    // Update number floating animation and glow
    if (this.numberDisplay && this.numberMaterial?.uniforms) {
      const time = performance.now() / 1000;
      
      if (this.numberDisplay.visible) {
        // Floating motion
        const floatOffset = Math.sin(time * this.NUMBER_FLOAT_SPEED) * this.NUMBER_FLOAT_AMPLITUDE;
        const baseY = this.beam.position.y + this.NUMBER_VERTICAL_OFFSET;
        this.numberDisplay.position.y = baseY + floatOffset;
        
        // Make number always face camera
        if (this.numberMesh) {
          // Find the main camera in the scene
          const camera = this.scene.children.find(child => child instanceof THREE.Camera) as THREE.Camera;
          if (camera) {
            this.numberMesh.lookAt(camera.position);
            // Keep the X rotation we set initially for tilting up
            this.numberMesh.rotation.x = -Math.PI / 6;
          }
        }
        
        // Update glow effect time
        this.numberMaterial.uniforms.time.value = time;
        this.numberMaterial.uniforms.opacity.value = 1.0;
      }
    }

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
      if (this.numberDisplay) {
        this.numberDisplay.visible = false;
        if (this.numberMesh) {
          this.numberMesh.visible = false;
        }
      }
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
