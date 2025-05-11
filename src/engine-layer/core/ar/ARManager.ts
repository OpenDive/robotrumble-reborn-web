import * as THREE from 'three';
import { VideoSourceFactory } from '../video/VideoSourceFactory';
import { VideoBackground } from '../renderer/VideoBackground';
import { IVideoSource, VideoConfig } from '../video/types';
import { MarkerDetector, Marker } from './MarkerDetector';

export class ARManager {
  private container!: HTMLElement;
  private static instance: ARManager;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private videoSource!: IVideoSource;
  private videoSourceFactory: VideoSourceFactory;
  private videoBackground!: VideoBackground;
  private markerDetector!: MarkerDetector;
  private markerMeshes!: Map<number, THREE.Mesh>;
  private frameCount: number = 0;
  private debugCube!: THREE.Mesh;
  private markerStats = {
    lastDetectionTime: 0,
    detectionFPS: 0,
    markersDetected: 0,
    lastProcessedFrame: 0,
    totalDetections: 0,
    errors: 0
  };

  private constructor() {
    console.log('ARManager: Constructor called');
    this.videoSourceFactory = VideoSourceFactory.getInstance();
  }

  static getInstance(): ARManager {
    if (!ARManager.instance) {
      ARManager.instance = new ARManager();
    }
    return ARManager.instance;
  }

  updateContainer(container: HTMLElement): void {
    // Move renderer to new container
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.remove();
    }
    container.appendChild(this.renderer.domElement);
  }

  /**
   * Update video source and reinitialize video background
   */
  async updateVideoSource(newSource: IVideoSource): Promise<void> {
    console.log('ARManager: Updating video source...');
    
    // Store the new source
    this.videoSource = newSource;
    
    // Wait for video element to be ready
    const videoElement = this.videoSource.getVideoElement();
    
    // Wait for video to be ready for playback
    if (videoElement.readyState < videoElement.HAVE_METADATA) {
      console.log('ARManager: Waiting for video metadata...');
      await new Promise<void>((resolve) => {
        const handleMetadata = () => {
          videoElement.removeEventListener('loadedmetadata', handleMetadata);
          resolve();
        };
        videoElement.addEventListener('loadedmetadata', handleMetadata);
      });
    }

    // Wait for actual video data
    if (videoElement.readyState < videoElement.HAVE_CURRENT_DATA) {
      console.log('ARManager: Waiting for video data...');
      await new Promise<void>((resolve) => {
        const handleData = () => {
          videoElement.removeEventListener('loadeddata', handleData);
          resolve();
        };
        videoElement.addEventListener('loadeddata', handleData);
      });
    }
    
    // Reinitialize video background with new source
    console.log('ARManager: Reinitializing video background...');
    this.videoBackground.initialize(videoElement, {
      distance: 0.1,
      baseHeight: 2.0,
      scale: 1.5
    });
    
    // Ensure video is playing
    try {
      if (videoElement.paused) {
        console.log('ARManager: Starting video playback...');
        await videoElement.play();
      }
    } catch (error) {
      console.error('ARManager: Failed to start video playback:', error);
      throw error;
    }
    
    console.log('ARManager: Video source updated', {
      readyState: videoElement.readyState,
      size: {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight
      },
      playing: !videoElement.paused
    });
  }

  public async initialize(container: HTMLElement): Promise<void> {
    // Store container reference
    this.container = container;

    // Create scene
    this.scene = new THREE.Scene();
    
    // Create camera with standard FOV
    this.camera = new THREE.PerspectiveCamera(
      60, // Standard FOV
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    
    // Position camera to see full video plane
    this.camera.position.z = 0.5; // Close to video plane
    this.camera.lookAt(0, 0, -1);
    
    console.log('Camera configured:', {
      fov: this.camera.fov,
      aspect: this.camera.aspect,
      position: this.camera.position.toArray()
    });

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });
    
    // Configure renderer
    this.renderer.setClearColor(0x0000ff, 1); // Blue for debugging
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // Set canvas style for proper sizing
    const canvas = this.renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    
    // Set size with pixel ratio
    const pixelRatio = window.devicePixelRatio;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false); // false to not set canvas style
    
    // Add debug grid and axes
    const grid = new THREE.GridHelper(2, 20, 0x444444, 0x444444);
    grid.rotation.x = Math.PI / 2;
    this.scene.add(grid);
    
    const axes = new THREE.AxesHelper(1);
    this.scene.add(axes);
    
    // Add debug cube
    const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    this.debugCube = new THREE.Mesh(geometry, material);
    this.debugCube.position.set(0.3, 0.3, -0.5);
    this.scene.add(this.debugCube);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);
    
    // Initialize components
    this.videoBackground = new VideoBackground();
    this.markerDetector = new MarkerDetector();
    this.markerMeshes = new Map();
    
    // Add renderer to container
    this.container.appendChild(this.renderer.domElement);
    
    // Debug logging
    console.log('ARManager: Scene initialized', {
      container: {
        width: this.container.clientWidth,
        height: this.container.clientHeight
      },
      renderer: {
        size: {
          width: this.renderer.domElement.width,
          height: this.renderer.domElement.height
        },
        pixelRatio: this.renderer.getPixelRatio()
      }
    });
    try {
      console.log('ARManager: Starting initialization...', {
        container: {
          width: container.clientWidth,
          height: container.clientHeight,
          inDOM: document.body.contains(container)
        }
      });

      // Add renderer to container
      container.appendChild(this.renderer.domElement);
      console.log('ARManager: Renderer added to container', {
        renderer: {
          size: this.renderer.getSize(new THREE.Vector2()),
          domElement: {
            width: this.renderer.domElement.clientWidth,
            height: this.renderer.domElement.clientHeight
          }
        }
      });
      
      // Initialize video source and marker detector
      console.log('ARManager: Initializing video source...');
      const videoConfig: VideoConfig = {
        sourceType: 'webcam',
        webcam: {
          width: 1280,
          height: 720
        }
      };
      this.videoSource = await this.videoSourceFactory.createSource(videoConfig);
      await this.videoSource.start(); // Start the video stream
      console.log('ARManager: Video stream started', {
        video: {
          readyState: this.videoSource.getVideoElement().readyState,
          size: {
            width: this.videoSource.getVideoElement().videoWidth,
            height: this.videoSource.getVideoElement().videoHeight
          }
        }
      });
      
      await this.markerDetector.initialize();
      console.log('ARManager: Marker detector initialized');
      
      // Set up video background with configuration
      console.log('ARManager: Setting up video background...');
      this.videoBackground.initialize(this.videoSource.getVideoElement(), {
        distance: 0.1,     // Close to camera
        baseHeight: 2.0,   // Moderate height
        scale: 1.5        // Slight scale up
      });
      this.scene.add(this.videoBackground.getMesh());
      console.log('ARManager: Video background added to scene', {
        mesh: {
          position: this.videoBackground.getMesh().position.toArray(),
          visible: this.videoBackground.getMesh().visible
        }
      });
      
      // Set up basic scene
      this.setupScene();
      console.log('ARManager: Scene setup complete', {
        camera: {
          position: this.camera.position.toArray(),
          fov: (this.camera as THREE.PerspectiveCamera).fov,
          aspect: (this.camera as THREE.PerspectiveCamera).aspect
        },
        debugCube: {
          position: this.debugCube.position.toArray(),
          visible: this.debugCube.visible
        }
      });
      
      // Start render loop
      this.animate();
      console.log('ARManager: Animation loop started');
      
      // Set up resize handler
      const handleResize = () => {
        if (!this.container) return;
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const pixelRatio = window.devicePixelRatio;
        
        // Update camera
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size without updating style
        this.renderer.setSize(width, height, false);
        this.renderer.setPixelRatio(pixelRatio);
        
        console.log('ARManager: Resized', {
          container: { width, height },
          canvas: {
            style: {
              width: this.renderer.domElement.style.width,
              height: this.renderer.domElement.style.height
            },
            actual: {
              width: this.renderer.domElement.width,
              height: this.renderer.domElement.height
            }
          },
          pixelRatio
        });
      };
      
      window.addEventListener('resize', handleResize);
      handleResize(); // Initial sizing
      
      console.log('ARManager: Initialization complete');
    } catch (error) {
      console.error('Failed to initialize AR system:', error);
      throw error;
    }
  }

  private setupScene(): void {
    // Position camera for proper view
    this.camera.position.z = 5;
    
    // Set initial renderer size
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    
    // Update camera aspect
    const camera = this.camera as THREE.PerspectiveCamera;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    
    // Rotate debug cube
    this.debugCube.rotation.x += 0.01;
    this.debugCube.rotation.y += 0.01;
    
    // Update video background
    this.videoBackground.update();
    
    // Log scene state periodically (every 60 frames)
    if (this.frameCount % 60 === 0) {
      console.log('ARManager: Scene state', {
        frame: this.frameCount,
        sceneObjects: this.scene.children.length,
        videoPlaying: !this.videoSource.getVideoElement().paused,
        videoReadyState: this.videoSource.getVideoElement().readyState,
        rendererInfo: this.renderer.info.render
      });
    }
    
    // Detect markers every 3rd frame for performance
    if (this.frameCount % 3 === 0) {
      const frame = this.videoSource.getCurrentFrame();
      if (frame) {
        try {
          // Update detection stats
          const now = performance.now();
          if (this.markerStats.lastDetectionTime > 0) {
            this.markerStats.detectionFPS = 1000 / (now - this.markerStats.lastDetectionTime);
          }
          this.markerStats.lastDetectionTime = now;
          this.markerStats.lastProcessedFrame = this.frameCount;

          // Detect markers
          const imageData = new ImageData(
            new Uint8ClampedArray(frame.data.buffer),
            frame.width,
            frame.height
          );
          const markers = this.markerDetector.detectMarkers(imageData);
          
          // Update stats
          this.markerStats.markersDetected = markers.length;
          this.markerStats.totalDetections += markers.length;

          // Update visualizations
          this.updateMarkerVisuals(markers);

          // Log stats periodically
          if (this.frameCount % 60 === 0) {
            console.log('Marker detection stats:', {
              fps: this.markerStats.detectionFPS.toFixed(1),
              currentMarkers: this.markerStats.markersDetected,
              totalDetections: this.markerStats.totalDetections,
              errors: this.markerStats.errors,
              frameSkip: this.frameCount - this.markerStats.lastProcessedFrame
            });
          }
        } catch (error) {
          this.markerStats.errors++;
          console.error('Error in marker detection:', error);
        }
      }
    }
    this.frameCount++;
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Get the video source for external use
   */
  getVideoSource(): IVideoSource {
    return this.videoSource;
  }

  getMarkerStats() {
    return {
      ...this.markerStats,
      fps: this.markerStats.detectionFPS.toFixed(1),
      frameSkip: this.frameCount - this.markerStats.lastProcessedFrame
    };
  }
  
  /**
   * Process a video frame for marker detection and visualization
   * @param frame The video frame to process
   */
  processFrame(frame: ImageData): void {
    // Update frame count
    this.frameCount++;

    // Process frame for marker detection every 3rd frame
    if (this.frameCount % 3 === 0) {
      try {
        console.log('ARManager: Processing frame', {
          frameCount: this.frameCount,
          frameData: {
            width: frame.width,
            height: frame.height,
            dataLength: frame.data.length,
            dataType: frame.data.constructor.name
          },
          videoElement: {
            width: this.videoSource.getVideoElement().videoWidth,
            height: this.videoSource.getVideoElement().videoHeight,
            readyState: this.videoSource.getVideoElement().readyState
          }
        });

        // Update detection stats
        const now = performance.now();
        if (this.markerStats.lastDetectionTime > 0) {
          this.markerStats.detectionFPS = 1000 / (now - this.markerStats.lastDetectionTime);
        }
        this.markerStats.lastDetectionTime = now;
        this.markerStats.lastProcessedFrame = this.frameCount;

        // Detect markers
        const markers = this.markerDetector.detectMarkers(frame);
        
        // Update stats
        this.markerStats.markersDetected = markers.length;
        this.markerStats.totalDetections += markers.length;

        // Log marker visualization
        if (markers.length > 0) {
          console.log('ARManager: Visualizing markers', {
            markerCount: markers.length,
            firstMarker: {
              id: markers[0].id,
              center: markers[0].center,
              corners: markers[0].corners
            },
            cameraInfo: {
              position: this.camera.position.toArray(),
              fov: this.camera.fov,
              aspect: this.camera.aspect
            }
          });
        }

        // Update visualizations
        this.updateMarkerVisuals(markers);

      } catch (error) {
        this.markerStats.errors++;
        console.error('ARManager: Error in marker detection:', error);
      }
    }

    // Always update video background
    this.videoBackground.update();
    
    // Log render stats periodically
    if (this.frameCount % 60 === 0) {
      console.log('ARManager: Render stats', {
        fps: this.markerStats.detectionFPS.toFixed(1),
        totalDetections: this.markerStats.totalDetections,
        errors: this.markerStats.errors,
        rendererInfo: this.renderer.info.render
      });
    }
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }
  
  private updateMarkerVisuals(markers: Marker[]): void {
    // Remove old marker meshes that are no longer detected
    for (const [id, mesh] of this.markerMeshes) {
      if (!markers.find(m => m.id === id)) {
        this.scene.remove(mesh);
        this.markerMeshes.delete(id);
      }
    }
    
    // Update or create marker visualizations
    markers.forEach((marker) => {
      let mesh = this.markerMeshes.get(marker.id);
      
      if (!mesh) {
        // Create new marker visualization
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.01); // Thinner box
        const material = new THREE.MeshBasicMaterial({
          color: 0xff0000,
          wireframe: true,
          transparent: true,
          opacity: 0.7
        });
        mesh = new THREE.Mesh(geometry, material);
        
        // Add axes helper to show orientation
        const axes = new THREE.AxesHelper(0.15);
        mesh.add(axes);
        
        // Add corner visualization
        const cornerGeometry = new THREE.SphereGeometry(0.01);
        const cornerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        for (let i = 0; i < 4; i++) {
          const corner = new THREE.Mesh(cornerGeometry, cornerMaterial);
          mesh.add(corner);
          corner.name = `corner${i}`;
        }
        
        this.markerMeshes.set(marker.id, mesh);
        this.scene.add(mesh);
      }
      
      // Update marker position and orientation
      const videoWidth = this.videoSource.getVideoElement().videoWidth;
      const videoHeight = this.videoSource.getVideoElement().videoHeight;
      
      // Update main marker position
      const centerX = (marker.center.x / videoWidth) * 2 - 1;
      const centerY = -(marker.center.y / videoHeight) * 2 + 1;
      mesh.position.set(centerX, centerY, -0.5);
      
      // Update corner positions
      marker.corners.forEach((corner, i) => {
        const cornerX = (corner.x / videoWidth) * 2 - 1;
        const cornerY = -(corner.y / videoHeight) * 2 + 1;
        const cornerMesh = mesh.getObjectByName(`corner${i}`) as THREE.Mesh;
        if (cornerMesh) {
          cornerMesh.position.set(
            cornerX - centerX,
            cornerY - centerY,
            0
          );
        }
      });
    });
  }


}

// Export singleton instance
export const arManager = ARManager.getInstance();
// Initialize it immediately
arManager;
