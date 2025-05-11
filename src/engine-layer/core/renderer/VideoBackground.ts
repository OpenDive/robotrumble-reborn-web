import * as THREE from 'three';

/**
 * Handles rendering video as a background in ThreeJS scene
 */
interface VideoPlaneConfig {
  distance?: number;     // Distance from camera (default: 0.1)
  baseHeight?: number;   // Base height in world units (default: 4.0)
  scale?: number;        // Additional scale factor (default: 1.0)
}

export class VideoBackground {
  private mesh: THREE.Mesh;
  private texture!: THREE.VideoTexture;
  private material: THREE.MeshBasicMaterial;
  private wireframeMesh: THREE.Mesh;
  private videoElement!: HTMLVideoElement;
  private lastVideoTime: number = -1;
  private isInitialized: boolean = false;

  constructor() {
    // Create initial plane geometry (will be resized in initialize)
    const geometry = new THREE.PlaneGeometry(1, 1);
    
    // Create material for video texture
    this.material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      depthTest: false,  // Ensure video is always visible
      depthWrite: false,  // Don't write to depth buffer
      transparent: false  // Disable transparency for solid video
    });
    
    // Create mesh for the video plane
    this.mesh = new THREE.Mesh(geometry, this.material);

    // Add wireframe outline to debug video plane bounds
    const wireGeometry = new THREE.PlaneGeometry(1, 1);
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      depthTest: false
    });
    this.wireframeMesh = new THREE.Mesh(wireGeometry, wireMaterial);
    this.mesh.add(this.wireframeMesh); // Add as child to follow transforms
    this.mesh.renderOrder = -1;  // Render first
  }

  /**
   * Reset the video background, cleaning up all resources
   */
  reset(): void {
    console.log('VideoBackground: Resetting...');
    // Dispose of old resources
    if (this.texture) {
      this.texture.dispose();
      this.material.map = null;
    }
    if (this.material) {
      this.material.needsUpdate = true;
    }
    this.lastVideoTime = -1;
    this.isInitialized = false;
    console.log('VideoBackground: Reset complete');
  }

  initialize(videoElement: HTMLVideoElement, config?: VideoPlaneConfig): void {
    console.log('VideoBackground: Initializing...', {
      videoReady: videoElement.readyState,
      videoDimensions: {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight
      }
    });

    // Reset existing resources
    this.reset();
    
    this.videoElement = videoElement;
    
    // Create and configure video texture
    this.texture = new THREE.VideoTexture(this.videoElement);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.format = THREE.RGBFormat;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    
    // Update material with video texture
    this.material.map = this.texture;
    this.material.needsUpdate = true;
    this.material.toneMapped = false;

    // Calculate and update plane size
    this.updatePlaneSize(config);
    
    this.isInitialized = true;
    
    console.log('VideoBackground: Initialization complete', {
      position: this.mesh.position.toArray(),
      texture: {
        size: { 
          width: this.videoElement.videoWidth,
          height: this.videoElement.videoHeight
        }
      }
    });
  }

  private updatePlaneSize(config?: VideoPlaneConfig): void {
    const defaultConfig: Required<VideoPlaneConfig> = {
      distance: 0.1,    // Close to camera
      baseHeight: 4.0,  // Moderate base height
      scale: 1.0       // No additional scaling
    };
    
    // Merge provided config with defaults
    const finalConfig = { ...defaultConfig, ...config };
    
    // Calculate plane size to fill view
    const videoWidth = this.videoElement.videoWidth || 1280;
    const videoHeight = this.videoElement.videoHeight || 720;
    const videoAspect = videoWidth / videoHeight;
    
    // Position plane at configured distance
    this.mesh.position.z = -finalConfig.distance;
    
    // Calculate size based on configured height
    const width = finalConfig.baseHeight * videoAspect;
    const height = finalConfig.baseHeight;
    
    // Create plane geometry with calculated size
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.PlaneGeometry(width, height);
    
    // Apply configured scale and flip horizontally to correct mirroring
    this.mesh.scale.set(-finalConfig.scale, finalConfig.scale, 1);
    
    // Ensure plane faces camera
    this.mesh.lookAt(0, 0, 0);
  }

  /**
   * Get the background mesh that can be added to a scene
   */
  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  /**
   * Update the background to match current video frame
   */
  update(): void {
    if (!this.isInitialized || !this.videoElement || !this.texture) {
      return;
    }

    // Check if video is ready and playing
    const currentTime = this.videoElement.currentTime;
    const readyState = this.videoElement.readyState;

    if (readyState >= this.videoElement.HAVE_CURRENT_DATA) {
      // Only update texture if video time has changed
      if (currentTime !== this.lastVideoTime) {
        this.texture.needsUpdate = true;
        this.lastVideoTime = currentTime;
      }
    } else {
      // Log waiting state less frequently to avoid spam
      console.warn('VideoBackground: Waiting for video data...', {
        readyState,
        currentTime,
        paused: this.videoElement.paused,
        ended: this.videoElement.ended,
        error: this.videoElement.error
      });
    }
  }

  dispose(): void {
    this.reset();
    if (this.mesh.geometry) {
      this.mesh.geometry.dispose();
    }
    if (this.wireframeMesh.geometry) {
      this.wireframeMesh.geometry.dispose();
    }
    if (this.wireframeMesh.material) {
      (this.wireframeMesh.material as THREE.Material).dispose();
    }
    this.material.dispose();
  }
}
