import * as THREE from 'three';
import { DetectedMarker } from './EnhancedARDetector';

interface AREffectsConfig {
  particleCount: number;
  particleSpread: number;
  glowIntensity: number;
  glowColor: number;
  animationSpeed: number;
}

export class AREffectsRenderer {
  private scene: THREE.Scene | null = null;
  private config: AREffectsConfig;
  
  // Particle system
  private particleSystem: THREE.Points | null = null;
  private particleGeometry: THREE.BufferGeometry | null = null;
  private particleMaterial: THREE.PointsMaterial | null = null;
  private particlePositions: Float32Array | null = null;
  private particleVelocities: Float32Array | null = null;
  
  // Ambient glow system
  private glowLights: THREE.PointLight[] = [];
  private glowSpheres: THREE.Mesh[] = [];
  
  // Animation state
  private time: number = 0;
  private frameCount: number = 0;

  constructor(config?: Partial<AREffectsConfig>) {
    this.config = {
      particleCount: 200,
      particleSpread: 8,
      glowIntensity: 0.8,
      glowColor: 0xFFD700,
      animationSpeed: 0.02,
      ...config
    };
  }

  initialize(scene: THREE.Scene): void {
    this.scene = scene;
    this.createParticleSystem();
    this.createAmbientGlow();
  }

  private createParticleSystem(): void {
    if (!this.scene) return;

    // Create particle geometry
    this.particleGeometry = new THREE.BufferGeometry();
    
    // Initialize particle positions and velocities
    this.particlePositions = new Float32Array(this.config.particleCount * 3);
    this.particleVelocities = new Float32Array(this.config.particleCount * 3);
    
    // Set initial particle positions and velocities
    for (let i = 0; i < this.config.particleCount; i++) {
      const i3 = i * 3;
      
      // Random positions in a sphere around the camera
      this.particlePositions[i3] = (Math.random() - 0.5) * this.config.particleSpread;     // x
      this.particlePositions[i3 + 1] = (Math.random() - 0.5) * this.config.particleSpread; // y
      this.particlePositions[i3 + 2] = (Math.random() - 0.5) * this.config.particleSpread; // z
      
      // Random velocities for floating motion
      this.particleVelocities[i3] = (Math.random() - 0.5) * 0.02;     // x velocity
      this.particleVelocities[i3 + 1] = (Math.random() - 0.5) * 0.02; // y velocity  
      this.particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.02; // z velocity
    }
    
    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    
    // Create particle material with glow effect
    this.particleMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.05,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      vertexColors: false,
      map: this.createParticleTexture()
    });
    
    // Create particle system
    this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.scene.add(this.particleSystem);
    
    console.log('AR Effects: Particle system created with', this.config.particleCount, 'particles');
  }

  private createParticleTexture(): THREE.Texture {
    // Create a canvas to draw the particle texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    
    const context = canvas.getContext('2d');
    if (!context) {
      return new THREE.Texture();
    }
    
    // Draw a glowing circle
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 30;
    
    // Create radial gradient for glow effect
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 215, 0, 0.8)'); // Golden yellow
    gradient.addColorStop(0.5, 'rgba(255, 215, 0, 0.3)'); // Golden yellow
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private createAmbientGlow(): void {
    if (!this.scene) return;

    // Create multiple ambient glow points
    const glowPositions = [
      { x: -2, y: 1, z: -3 },
      { x: 2, y: 2, z: -4 },
      { x: 0, y: 3, z: -2 },
      { x: -3, y: 0.5, z: -5 },
      { x: 3, y: 1.5, z: -3 }
    ];

    glowPositions.forEach((pos, index) => {
      // Create point light for ambient glow
      const light = new THREE.PointLight(this.config.glowColor, this.config.glowIntensity, 10);
      light.position.set(pos.x, pos.y, pos.z);
      this.glowLights.push(light);
      this.scene!.add(light);
      
      // Create visible glow sphere
      const glowGeometry = new THREE.SphereGeometry(0.1, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: this.config.glowColor,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
      });
      
      const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
      glowSphere.position.copy(light.position);
      this.glowSpheres.push(glowSphere);
      this.scene!.add(glowSphere);
    });
    
    console.log('AR Effects: Created', this.glowLights.length, 'ambient glow lights');
  }

  update(): void {
    if (!this.particleSystem || !this.particlePositions || !this.particleVelocities) return;
    
    this.time += this.config.animationSpeed;
    this.frameCount++;
    
    // Update particles
    this.updateParticles();
    
    // Update ambient glow
    this.updateAmbientGlow();
  }

  private updateParticles(): void {
    if (!this.particlePositions || !this.particleVelocities || !this.particleGeometry) return;

    // Update particle positions
    for (let i = 0; i < this.config.particleCount; i++) {
      const i3 = i * 3;
      
      // Apply velocity
      this.particlePositions[i3] += this.particleVelocities[i3];
      this.particlePositions[i3 + 1] += this.particleVelocities[i3 + 1];
      this.particlePositions[i3 + 2] += this.particleVelocities[i3 + 2];
      
      // Add some floating motion with sine waves
      this.particlePositions[i3] += Math.sin(this.time + i * 0.1) * 0.001;
      this.particlePositions[i3 + 1] += Math.cos(this.time + i * 0.1) * 0.001;
      
      // Reset particles that go too far
      const distance = Math.sqrt(
        this.particlePositions[i3] * this.particlePositions[i3] +
        this.particlePositions[i3 + 1] * this.particlePositions[i3 + 1] +
        this.particlePositions[i3 + 2] * this.particlePositions[i3 + 2]
      );
      
      if (distance > this.config.particleSpread / 2) {
        // Reset to center with new random velocity
        this.particlePositions[i3] = (Math.random() - 0.5) * 0.5;
        this.particlePositions[i3 + 1] = (Math.random() - 0.5) * 0.5;
        this.particlePositions[i3 + 2] = (Math.random() - 0.5) * 0.5;
        
        this.particleVelocities[i3] = (Math.random() - 0.5) * 0.02;
        this.particleVelocities[i3 + 1] = (Math.random() - 0.5) * 0.02;
        this.particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
      }
    }
    
    // Update geometry
    this.particleGeometry.getAttribute('position').needsUpdate = true;
  }

  private updateAmbientGlow(): void {
    // Animate glow intensity and position
    this.glowLights.forEach((light, index) => {
      // Pulsing intensity
      const pulse = Math.sin(this.time * 2 + index) * 0.3 + 0.7;
      light.intensity = this.config.glowIntensity * pulse;
      
      // Subtle floating motion
      const originalY = this.glowSpheres[index].position.y;
      light.position.y = originalY + Math.sin(this.time + index * 2) * 0.2;
      this.glowSpheres[index].position.copy(light.position);
      
      // Update glow sphere opacity
      const material = this.glowSpheres[index].material as THREE.MeshBasicMaterial;
      material.opacity = 0.4 + pulse * 0.3;
    });
  }

  updateWithMarkers(markers: DetectedMarker[]): void {
    // For now, we'll just create more particles and glow effects when markers are detected
    if (markers.length > 0 && this.frameCount % 60 === 0) {
      console.log(`AR Effects: Enhancing effects based on ${markers.length} detected markers`);
      
      // Temporarily increase glow intensity when markers are detected
      this.glowLights.forEach(light => {
        light.intensity = this.config.glowIntensity * 1.5;
      });
      
      // Reset after a brief time
      setTimeout(() => {
        this.glowLights.forEach(light => {
          light.intensity = this.config.glowIntensity;
        });
      }, 500);
    }
  }

  dispose(): void {
    if (this.scene) {
      // Remove particle system
      if (this.particleSystem) {
        this.scene.remove(this.particleSystem);
        this.particleGeometry?.dispose();
        this.particleMaterial?.dispose();
        this.particleSystem = null;
      }
      
      // Remove glow lights and spheres
      this.glowLights.forEach(light => this.scene!.remove(light));
      this.glowSpheres.forEach(sphere => {
        this.scene!.remove(sphere);
        sphere.geometry.dispose();
        (sphere.material as THREE.Material).dispose();
      });
      
      this.glowLights = [];
      this.glowSpheres = [];
    }
    
    this.scene = null;
    this.particlePositions = null;
    this.particleVelocities = null;
  }
} 