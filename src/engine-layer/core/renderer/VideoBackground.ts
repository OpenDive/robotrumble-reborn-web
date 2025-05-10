import * as THREE from 'three';

/**
 * Handles rendering video as a background in ThreeJS scene
 */
export class VideoBackground {
  private mesh: THREE.Mesh;
  private texture!: THREE.VideoTexture;
  private material: THREE.MeshBasicMaterial;
  private wireframeMesh: THREE.Mesh;
  private videoElement!: HTMLVideoElement;

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

  initialize(videoElement: HTMLVideoElement): void {
    console.log('Initializing video background...');
    
    this.videoElement = videoElement;
    
    // Create and configure video texture
    console.log('VideoBackground: Creating texture from video element', {
      videoReady: this.videoElement.readyState,
      videoDimensions: {
        width: this.videoElement.videoWidth,
        height: this.videoElement.videoHeight
      },
      playing: !this.videoElement.paused
    });

    this.texture = new THREE.VideoTexture(this.videoElement);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.format = THREE.RGBAFormat;  // Use RGBA for better compatibility
    this.texture.colorSpace = THREE.SRGBColorSpace;  // Use sRGB color space
    this.texture.generateMipmaps = false;  // Not needed for video
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;

    console.log('VideoBackground: Texture created', {
      format: this.texture.format,
      colorSpace: this.texture.colorSpace,
      filters: {
        min: this.texture.minFilter,
        mag: this.texture.magFilter
      }
    });
    
    // Update material
    this.material.map = this.texture;
    this.material.needsUpdate = true;

    // Calculate plane size to fill view
    const videoAspect = this.videoElement.videoWidth / this.videoElement.videoHeight;
    console.log('Video background aspect ratio:', videoAspect);

    // Position plane at fixed distance
    const distance = 0.5; // Keep video plane very close
    this.mesh.position.z = -distance;
    
    // Calculate required plane size using camera FOV
    const fov = 60; // Must match camera FOV
    const height = 2 * distance * Math.tan((fov * Math.PI / 180) / 2);
    const width = height * videoAspect;

    // Update plane geometry with fixed size
    this.mesh.geometry = new THREE.PlaneGeometry(width, height);
    
    // Ensure plane faces camera and fills view
    this.mesh.scale.set(1.2, 1.2, 1); // Scale up slightly to ensure full coverage
    this.mesh.lookAt(0, 0, 0);
    
    console.log('Video background initialized', {
      position: this.mesh.position.toArray(),
      dimensions: { width, height },
      texture: {
        size: { 
          width: this.videoElement.videoWidth,
          height: this.videoElement.videoHeight
        }
      }
    });
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
    if (this.videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or better
      this.texture.needsUpdate = true;
      console.log('VideoBackground: Updated texture', {
        videoTime: this.videoElement.currentTime,
        readyState: this.videoElement.readyState,
        playing: !this.videoElement.paused
      });
    }
  }

  /**
   * Clean up ThreeJS resources
   */
  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
