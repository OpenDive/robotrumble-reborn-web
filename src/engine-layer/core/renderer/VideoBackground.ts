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

  initialize(videoElement: HTMLVideoElement, config?: VideoPlaneConfig): void {
    const defaultConfig: Required<VideoPlaneConfig> = {
      distance: 0.1,    // Close to camera
      baseHeight: 4.0,  // Moderate base height
      scale: 1.0       // No additional scaling
    };
    
    // Merge provided config with defaults
    const finalConfig = { ...defaultConfig, ...config };
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

    // Create video texture with auto-update disabled (we'll handle updates manually)
    this.texture = new THREE.VideoTexture(this.videoElement);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.format = THREE.RGBFormat;  // Use RGB for video (no alpha needed)
    this.texture.colorSpace = THREE.SRGBColorSpace;  // Use sRGB color space
    this.texture.generateMipmaps = false;  // Not needed for video
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    
    // Force initial texture update
    this.texture.needsUpdate = true;

    console.log('VideoBackground: Texture created', {
      format: this.texture.format,
      colorSpace: this.texture.colorSpace,
      filters: {
        min: this.texture.minFilter,
        mag: this.texture.magFilter
      }
    });
    
    // Update material with video texture
    this.material.map = this.texture;
    this.material.needsUpdate = true;
    
    // Set material properties for video display
    this.material.toneMapped = false; // Preserve video colors
    this.material.side = THREE.DoubleSide; // Visible from both sides
    this.material.depthTest = false; // Always render on top
    this.material.depthWrite = false; // Don't write to depth buffer
    
    // Calculate plane size to fill view
    const videoWidth = this.videoElement.videoWidth || 1280; // Fallback if not ready
    const videoHeight = this.videoElement.videoHeight || 720;
    const videoAspect = videoWidth / videoHeight;
    
    console.log('Video background dimensions:', {
      width: videoWidth,
      height: videoHeight,
      aspect: videoAspect,
      materialState: {
        map: this.material.map ? 'set' : 'null',
        needsUpdate: this.material.needsUpdate,
        toneMapped: this.material.toneMapped,
        depthTest: this.material.depthTest
      }
    });

    // Position plane at configured distance
    this.mesh.position.z = -finalConfig.distance;
    
    // Calculate size based on configured height
    const width = finalConfig.baseHeight * videoAspect;
    const height = finalConfig.baseHeight;
    
    // Create plane geometry with calculated size
    this.mesh.geometry = new THREE.PlaneGeometry(width, height);
    
    // Apply configured scale
    this.mesh.scale.set(finalConfig.scale, finalConfig.scale, 1);
    
    console.log('Video plane configured:', {
      position: this.mesh.position.toArray(),
      dimensions: { width, height },
      videoAspect
    });
    
    // Ensure plane faces camera
    this.mesh.lookAt(0, 0, 0);
    
    // console.log('Video background configured:', {
    //   distance,
    //   fov,
    //   dimensions: { width: width * scale, height: height * scale },
    //   videoAspect
    // });
    
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
    // Only update texture if we have a valid video frame
    if (this.videoElement.readyState >= this.videoElement.HAVE_CURRENT_DATA) {
      this.texture.needsUpdate = true;
      // console.log('VideoBackground: Updated texture', {
      //   videoTime: this.videoElement.currentTime,
      //   readyState: this.videoElement.readyState,
      //   playing: !this.videoElement.paused,
      //   width: this.videoElement.videoWidth,
      //   height: this.videoElement.videoHeight
      // });
    } else {
      console.warn('VideoBackground: Waiting for video data...', {
        readyState: this.videoElement.readyState,
        currentTime: this.videoElement.currentTime,
        paused: this.videoElement.paused
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
