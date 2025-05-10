import * as THREE from 'three';
import { WebcamVideoSource } from '../video/WebcamVideoSource';
import { VideoBackground } from '../renderer/VideoBackground';
import { MarkerDetector, Marker } from './MarkerDetector';

export class ARManager {
  private static instance: ARManager;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private videoSource: WebcamVideoSource;
  private videoBackground: VideoBackground;
  private markerDetector: MarkerDetector;
  private markerMeshes: Map<number, THREE.Mesh>;
  private frameCount: number;

  private constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(this.renderer.domElement);
    
    // Initialize video source and marker detector
    await this.videoSource.initialize();
    await this.markerDetector.initialize();
    
    // Set up video background
    this.videoBackground.initialize(this.videoSource.getVideoElement());
    this.scene.add(this.videoBackground.getMesh());
    
    // Set up basic scene
    this.setupScene();
    
    // Start render loop
    this.animate();
    
    // Handle window resize
    window.addEventListener('resize', this.handleResize);
  }
  
  private handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private setupScene(): void {
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    this.scene.add(directionalLight);

    // Position camera
    this.camera.position.z = 5;
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
