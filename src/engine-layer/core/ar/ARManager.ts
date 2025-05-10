import * as THREE from 'three';
import { WebcamVideoSource } from '../video/WebcamVideoSource';
import { VideoBackground } from '../renderer/VideoBackground';
import { MarkerDetector, Marker } from './MarkerDetector';

export class ARManager {
  private static instance: ARManager;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private videoSource: WebcamVideoSource;
  private videoBackground: VideoBackground;
  private markerDetector: MarkerDetector;
  private markerMeshes: Map<number, THREE.Mesh>;
  private frameCount: number;

  private constructor() {
    this.scene = new THREE.Scene();
    
    // Use orthographic camera for video background
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    this.videoSource = new WebcamVideoSource();
    this.videoBackground = new VideoBackground();
    this.markerDetector = new MarkerDetector();
    this.markerMeshes = new Map();
    this.frameCount = 0;
  }

  static getInstance(): ARManager {
    if (!ARManager.instance) {
      ARManager.instance = new ARManager();
    }
    return ARManager.instance;
  }

  async initialize(container: HTMLElement): Promise<void> {
    try {
      console.log('Initializing AR system...');
      
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      container.appendChild(this.renderer.domElement);
      
      // Initialize video source and marker detector
      console.log('Initializing video source...');
      await this.videoSource.initialize();
      await this.videoSource.start(); // Start the video stream
      console.log('Video source initialized and started');
      
      await this.markerDetector.initialize();
      
      // Set up video background
      console.log('Setting up video background...');
      this.videoBackground.initialize(this.videoSource.getVideoElement());
      this.scene.add(this.videoBackground.getMesh());
      
      // Set up basic scene
      this.setupScene();
      
      // Start render loop
      this.animate();
      
      // Handle window resize
      window.addEventListener('resize', this.handleResize);
      
      console.log('AR system initialization complete');
    } catch (error) {
      console.error('Failed to initialize AR system:', error);
      throw error;
    }
  }
  
  private handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Update renderer size
    this.renderer.setSize(width, height);
    
    // Cast to OrthographicCamera to access its specific properties
    const camera = this.camera as THREE.OrthographicCamera;
    camera.left = -1;
    camera.right = 1;
    camera.top = 1;
    camera.bottom = -1;
    camera.updateProjectionMatrix();
  }

  private setupScene(): void {
    // Position camera at z=0 for orthographic view
    this.camera.position.z = 0;
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    
    // Update video background
    this.videoBackground.update();
    
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

export const arManager = ARManager.getInstance();
