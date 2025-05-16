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
  private markerMeshes: Map<number, THREE.Group> = new Map();
  private frameCount: number = 0;
  private debugCube!: THREE.Mesh;
  private markerStats = {
    lastDetectionTime: 0,
    detectionFPS: 0,
    markersDetected: 0,
    lastProcessedFrame: 0,
    totalDetections: 0,
    errors: 0,
    processingTime: 0,
    totalProcessingTime: 0,
    frameCount: 0,
    avgProcessingTime: 0,
    memoryStats: {
      jsHeapSizeLimit: 0,
      totalJSHeapSize: 0,
      usedJSHeapSize: 0,
      lastGCTime: 0
    }
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
    // const grid = new THREE.GridHelper(2, 20, 0x444444, 0x444444);
    // grid.rotation.x = Math.PI / 2;
    // this.scene.add(grid);
    
    // const axes = new THREE.AxesHelper(1);
    // this.scene.add(axes);
    
    // Add debug cube
    // const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    // const material = new THREE.MeshBasicMaterial({ 
    //   color: 0x00ff00,
    //   wireframe: true,
    //   transparent: true,
    //   opacity: 0.5
    // });
    // this.debugCube = new THREE.Mesh(geometry, material);
    // this.debugCube.position.set(0.3, 0.3, -0.5);
    // this.scene.add(this.debugCube);
    
    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);
    
    // Initialize components
    this.videoBackground = new VideoBackground();
    this.markerDetector = new MarkerDetector();
    
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
      // console.log('ARManager: Scene setup complete', {
      //   camera: {
      //     position: this.camera.position.toArray(),
      //     fov: (this.camera as THREE.PerspectiveCamera).fov,
      //     aspect: (this.camera as THREE.PerspectiveCamera).aspect
      //   },
      //   debugCube: {
      //     position: this.debugCube.position.toArray(),
      //     visible: this.debugCube.visible
      //   }
      // });
      
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
    
    // Update video background
    this.videoBackground.update();
    
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

          // Update memory stats if performance.memory is available
          if ((performance as any).memory) {
            const memory = (performance as any).memory;
            this.markerStats.memoryStats = {
              jsHeapSizeLimit: memory.jsHeapSizeLimit,
              totalJSHeapSize: memory.totalJSHeapSize,
              usedJSHeapSize: memory.usedJSHeapSize,
              lastGCTime: now
            };
          }

          // Use frame directly from video source
          const markers = this.markerDetector.detectMarkers(frame);
          
          // Update stats
          this.markerStats.markersDetected = markers.length;
          this.markerStats.totalDetections += markers.length;

          // Update visualizations
          this.updateMarkerVisuals(markers);

          // Log stats periodically
          if (this.frameCount % 60 === 0) {
            const memStats = this.markerStats.memoryStats;
            console.log('System Stats:', {
              performance: {
                fps: this.markerStats.detectionFPS.toFixed(1),
                currentMarkers: this.markerStats.markersDetected,
                totalDetections: this.markerStats.totalDetections,
                errors: this.markerStats.errors,
                frameSkip: this.frameCount - this.markerStats.lastProcessedFrame
              },
              memory: {
                heapUsed: (memStats.usedJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
                heapTotal: (memStats.totalJSHeapSize / 1024 / 1024).toFixed(2) + ' MB',
                heapLimit: (memStats.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + ' MB',
                heapUsage: ((memStats.usedJSHeapSize / memStats.totalJSHeapSize) * 100).toFixed(1) + '%'
              },
              renderer: this.renderer.info.render,
              scene: {
                objects: this.scene.children.length,
                markers: this.markerMeshes.size
              }
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
      frameSkip: this.frameCount - this.markerStats.lastProcessedFrame,
      memoryStats: (performance as any).memory ? {
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        lastGCTime: performance.now()
      } : null
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
    for (const [id, group] of this.markerMeshes) {
      if (!markers.find(m => m.id === id)) {
        this.scene.remove(group);
        this.markerMeshes.delete(id);
      }
    }
    
    // Video background configuration constants - match VideoBackground settings
    const VIDEO_SCALE = 1.5;
    const BASE_HEIGHT = 2.0;
    const Z_DISTANCE = 0.1;
    
    // Marker visualization sizes - adjusted for better visibility
    const BOX_SIZE = 0.2 * VIDEO_SCALE;
    const AXES_SIZE = 0.3 * VIDEO_SCALE;
    const CORNER_SIZE = 0.015 * VIDEO_SCALE;
    
    // Update or create marker visualizations
    markers.forEach((marker) => {
      let markerGroup = this.markerMeshes.get(marker.id);
      
      if (!markerGroup) {
        // Create new marker visualization group
        markerGroup = new THREE.Group();
        
        // Create cube with colored faces
        const cubeSize = BOX_SIZE;
        const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        
        // Create materials for each face
        const materials = [
          new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 }), // Right - Red
          new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.6 }), // Left - Blue
          new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.6 }), // Top - Green
          new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.6 }), // Bottom - Yellow
          new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.6 }), // Front - Magenta
          new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 })  // Back - Cyan
        ];
        
        // Create cube mesh with materials
        const cubeMesh = new THREE.Mesh(cubeGeometry, materials);
        
        // Add wireframe overlay
        const wireframeGeometry = new THREE.BoxGeometry(cubeSize * 1.001, cubeSize * 1.001, cubeSize * 1.001);
        const wireframeMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          wireframe: true,
          transparent: true,
          opacity: 0.2
        });
        const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
        
        // Add cube and wireframe to group
        markerGroup.add(cubeMesh);
        markerGroup.add(wireframeMesh);
        
        // Create custom axes with labels and arrows
        const axesGroup = new THREE.Group();
        
        // X-axis (red)
        const xAxis = new THREE.ArrowHelper(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 0, 0),
          AXES_SIZE,
          0xff0000,
          AXES_SIZE * 0.2,  // Head length
          AXES_SIZE * 0.1   // Head width
        );
        const xLabel = this.createAxisLabel('X', 0xff0000);
        xLabel.position.set(AXES_SIZE + 0.05, 0, 0);
        axesGroup.add(xAxis);
        axesGroup.add(xLabel);
        
        // Y-axis (green)
        const yAxis = new THREE.ArrowHelper(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, 0, 0),
          AXES_SIZE,
          0x00ff00,
          AXES_SIZE * 0.2,
          AXES_SIZE * 0.1
        );
        const yLabel = this.createAxisLabel('Y', 0x00ff00);
        yLabel.position.set(0, AXES_SIZE + 0.05, 0);
        axesGroup.add(yAxis);
        axesGroup.add(yLabel);
        
        // Z-axis (blue)
        const zAxis = new THREE.ArrowHelper(
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, 0),
          AXES_SIZE,
          0x0000ff,
          AXES_SIZE * 0.2,
          AXES_SIZE * 0.1
        );
        const zLabel = this.createAxisLabel('Z', 0x0000ff);
        zLabel.position.set(0, 0, AXES_SIZE + 0.05);
        axesGroup.add(zAxis);
        axesGroup.add(zLabel);
        
        markerGroup.add(axesGroup);
        
        // Add corner visualization with improved materials
        const cornerGeometry = new THREE.SphereGeometry(CORNER_SIZE);
        const cornerMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xffff00,
          transparent: true,
          opacity: 0.8
        });
        
        // Add numbered corners for better tracking
        for (let i = 0; i < 4; i++) {
          const cornerGroup = new THREE.Group();
          const corner = new THREE.Mesh(cornerGeometry, cornerMaterial);
          cornerGroup.add(corner);
          
          // Add corner number label
          const label = this.createAxisLabel(String(i), 0xffff00);
          label.scale.set(0.5, 0.5, 0.5);
          label.position.set(CORNER_SIZE * 2, CORNER_SIZE * 2, 0);
          cornerGroup.add(label);
          
          cornerGroup.name = `corner${i}`;
          markerGroup.add(cornerGroup);
        }
        
        this.markerMeshes.set(marker.id, markerGroup);
        this.scene.add(markerGroup);
      }
      
      // At this point markerGroup is guaranteed to exist
      const videoElement = this.videoSource.getVideoElement();
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      
      // Calculate video aspect ratio and scale factors
      const videoAspect = videoWidth / videoHeight;
      const scaleY = BASE_HEIGHT / 2;
      const scaleX = scaleY * videoAspect;
      
      // Transform marker corners to scene space
      const transformedCorners = marker.corners.map(corner => {
        const x = ((corner.x / videoWidth) - 0.5) * 2 * scaleX * VIDEO_SCALE;
        const y = (0.5 - (corner.y / videoHeight)) * 2 * scaleY * VIDEO_SCALE;
        return new THREE.Vector3(x, y, -Z_DISTANCE);
      });
      
      // Calculate marker center in scene space
      const centerX = ((marker.center.x / videoWidth) - 0.5) * 2 * scaleX * VIDEO_SCALE;
      const centerY = (0.5 - (marker.center.y / videoHeight)) * 2 * scaleY * VIDEO_SCALE;
      const centerPos = new THREE.Vector3(centerX, centerY, -Z_DISTANCE);

      // Set base position using video coordinates
      markerGroup.position.copy(centerPos);

      // If we have pose information, use it for rotation and Z-depth
      if (marker.pose) {
        // Add Z-translation for depth perception
        const zScale = 0.0001; // Small scale factor for millimeter to scene units
        markerGroup.position.z = -Math.abs(marker.pose.bestTranslation[2] * zScale);

        // Convert pose rotation matrix to THREE.js matrix
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.set(
          marker.pose.bestRotation[0][0], marker.pose.bestRotation[0][1], marker.pose.bestRotation[0][2], 0,
          marker.pose.bestRotation[1][0], marker.pose.bestRotation[1][1], marker.pose.bestRotation[1][2], 0,
          marker.pose.bestRotation[2][0], marker.pose.bestRotation[2][1], marker.pose.bestRotation[2][2], 0,
          0, 0, 0, 1
        );

        // Apply rotation to group
        markerGroup.setRotationFromMatrix(rotationMatrix);

        // Update corner positions in local space
        transformedCorners.forEach((worldCorner, i) => {
          const cornerGroup = markerGroup.getObjectByName(`corner${i}`) as THREE.Group | undefined;
          if (cornerGroup) {
            // Convert world corner to local space relative to marker center
            const localCorner = worldCorner.clone()
              .sub(centerPos)
              .applyMatrix4(new THREE.Matrix4().copy(rotationMatrix).invert());
            
            cornerGroup.position.copy(localCorner);
          }
        });
      }
    });
  }

  private createAxisLabel(text: string, color: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      context.font = 'bold 48px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, 32, 32);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(0.1, 0.1, 1);
    
    return sprite;
  }
}

// Export singleton instance
export const arManager = ARManager.getInstance();
// Initialize it immediately
arManager;
