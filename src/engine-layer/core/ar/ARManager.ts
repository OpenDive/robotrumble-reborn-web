import * as THREE from 'three';
import { WebcamVideoSource } from '../video/WebcamVideoSource';
import { VideoBackground } from '../renderer/VideoBackground';
import { MarkerDetector, Marker } from './MarkerDetector';

export class ARManager {
  private container!: HTMLElement;
  private static instance: ARManager;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private videoSource!: WebcamVideoSource;
  private videoBackground!: VideoBackground;
  private markerDetector!: MarkerDetector;
  private markerMeshes!: Map<number, THREE.Mesh>;
  private frameCount: number = 0;
  private debugCube!: THREE.Mesh;

  private constructor() {
    console.log('ARManager: Constructor called');
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

  public async initialize(container: HTMLElement): Promise<void> {
    // Store container reference
    this.container = container;

    // Create scene
    this.scene = new THREE.Scene();
    
    // Create camera with wider FOV
    this.camera = new THREE.PerspectiveCamera(
      75,  // Wider FOV to see more
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    
    // Position camera closer to video plane
    this.camera.position.z = 1; // Move camera closer
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
    this.videoSource = new WebcamVideoSource();
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
      await this.videoSource.initialize();
      console.log('ARManager: Video source initialized');
      
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
      
      // Set up video background
      console.log('ARManager: Setting up video background...');
      this.videoBackground.initialize(this.videoSource.getVideoElement());
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
        // Convert frame to ImageData for marker detection
        const imageData = new ImageData(
          new Uint8ClampedArray(frame.data.buffer),
          frame.width,
          frame.height
        );
        const markers = this.markerDetector.detectMarkers(imageData);
        this.updateMarkerVisuals(markers);
      }
    }
    this.frameCount++;
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Get the video source for external use
   */
  getVideoSource(): WebcamVideoSource {
    return this.videoSource;
  };
  
  private updateMarkerVisuals(markers: Marker[]): void {
    // Remove old markers
    this.markerMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
    });
    this.markerMeshes.clear();
    
    // Add new markers
    markers.forEach((marker) => {
      const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
      const mesh = new THREE.Mesh(geometry, material);
      
      // Position mesh at marker center
      mesh.position.set(
        marker.center.x / this.videoSource.getWidth() * 2 - 1,
        -(marker.center.y / this.videoSource.getHeight() * 2 - 1),
        0
      );
      
      this.scene.add(mesh);
      this.markerMeshes.set(marker.id, mesh);
    });
  }


}

// Export singleton instance
export const arManager = ARManager.getInstance();
// Initialize it immediately
arManager;
