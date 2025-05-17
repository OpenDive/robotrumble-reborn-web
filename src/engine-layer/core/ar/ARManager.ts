import * as THREE from 'three';
import { VideoSourceFactory } from '../video/VideoSourceFactory';
import { VideoBackground } from '../renderer/VideoBackground';
import { IVideoSource, VideoConfig } from '../video/types';
import { MarkerDetector, Marker } from './MarkerDetector';
import { MarkerVisualizer } from './MarkerVisualizer';
import { StatsService } from './StatsService';

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
  private markerVisualizer!: MarkerVisualizer;
  private statsService: StatsService;
  private frameCount: number = 0;

  private constructor() {
    console.log('ARManager: Constructor called');
    this.videoSourceFactory = VideoSourceFactory.getInstance();
    this.statsService = StatsService.getInstance();
  }

  static getInstance(): ARManager {
    if (!ARManager.instance) {
      ARManager.instance = new ARManager();
    }
    return ARManager.instance;
  }

  updateContainer(container: HTMLElement): void {
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.remove();
    }
    container.appendChild(this.renderer.domElement);
  }

  async updateVideoSource(newSource: IVideoSource): Promise<void> {
    console.log('ARManager: Updating video source...');
    this.videoSource = newSource;
    
    const videoElement = this.videoSource.getVideoElement();
    
    if (videoElement.readyState < videoElement.HAVE_METADATA) {
      await new Promise<void>((resolve) => {
        videoElement.addEventListener('loadedmetadata', () => resolve(), { once: true });
      });
    }

    if (videoElement.readyState < videoElement.HAVE_CURRENT_DATA) {
      await new Promise<void>((resolve) => {
        videoElement.addEventListener('loadeddata', () => resolve(), { once: true });
      });
    }
    
    this.videoBackground.initialize(videoElement, {
      distance: 0.1,
      baseHeight: 2.0,
      scale: 1.5
    });
    
    this.markerVisualizer.updateVideoSource(newSource);
    
    try {
      if (videoElement.paused) {
        await videoElement.play();
      }
    } catch (error) {
      console.error('ARManager: Failed to start video playback:', error);
      throw error;
    }
  }

  public async initialize(container: HTMLElement): Promise<void> {
    this.container = container;
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    
    this.camera.position.z = 0.5;
    this.camera.lookAt(0, 0, -1);

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });
    
    this.renderer.setClearColor(0x0000ff, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    const canvas = this.renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    
    const pixelRatio = window.devicePixelRatio;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    this.scene.add(ambientLight);
    
    this.videoBackground = new VideoBackground();
    this.markerDetector = new MarkerDetector();
    
    this.container.appendChild(this.renderer.domElement);

    try {
      const videoConfig: VideoConfig = {
        sourceType: 'webcam',
        webcam: {
          width: 1280,
          height: 720
        }
      };
      this.videoSource = await this.videoSourceFactory.createSource(videoConfig);
      await this.videoSource.start();
      await this.markerDetector.initialize();
      
      this.videoBackground.initialize(this.videoSource.getVideoElement(), {
        distance: 0.1,
        baseHeight: 2.0,
        scale: 1.5
      });
      this.scene.add(this.videoBackground.getMesh());
      
      this.markerVisualizer = new MarkerVisualizer(this.videoSource, {
        videoScale: 1.5,
        baseHeight: 2.0,
        zDistance: 0.1
      });
      this.markerVisualizer.attachToScene(this.scene);
      
      this.setupScene();
      this.animate();
      
      window.addEventListener('resize', () => {
        if (!this.container) return;
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        const pixelRatio = window.devicePixelRatio;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height, false);
        this.renderer.setPixelRatio(pixelRatio);
      });
      
    } catch (error) {
      console.error('Failed to initialize AR system:', error);
      throw error;
    }
  }

  private setupScene(): void {
    this.camera.position.z = 5;
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    
    this.frameCount++;
    this.statsService.updateFrameCount(this.frameCount);
    
    this.videoBackground.update();
    
    if (this.frameCount % 3 === 0) {
      const frame = this.videoSource.getCurrentFrame();
      if (frame) {
        try {
          this.statsService.updateMemoryStats();
          const markers = this.markerDetector.detectMarkers(frame);
          this.statsService.updateDetectionStats(markers.length);
          this.markerVisualizer.updateVisuals(markers);

          if (this.frameCount % 60 === 0) {
            console.log('System Stats:', {
              ...this.statsService.getFormattedStats(),
              renderer: this.renderer.info.render,
              scene: { objects: this.scene.children.length }
            });
          }
        } catch (error) {
          this.statsService.recordError();
          console.error('Error in marker detection:', error);
        }
      }
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  getVideoSource(): IVideoSource {
    return this.videoSource;
  }

  getStats() {
    return this.statsService.getStats();
  }
  
  processFrame(frame: ImageData): void {
    this.frameCount++;
    this.statsService.updateFrameCount(this.frameCount);

    if (this.frameCount % 3 === 0) {
      try {
        this.statsService.updateMemoryStats();
        const markers = this.markerDetector.detectMarkers(frame);
        this.statsService.updateDetectionStats(markers.length);

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

        this.markerVisualizer.updateVisuals(markers);
      } catch (error) {
        this.statsService.recordError();
        console.error('ARManager: Error in marker detection:', error);
      }
    }

    this.videoBackground.update();
    
    if (this.frameCount % 60 === 0) {
      console.log('ARManager: Render stats', {
        ...this.statsService.getFormattedStats(),
        rendererInfo: this.renderer.info.render
      });
    }
    
    this.renderer.render(this.scene, this.camera);
  }
  
  dispose(): void {
    if (this.markerVisualizer) {
      this.markerVisualizer.dispose();
    }
    if (this.videoBackground) {
      this.videoBackground.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

export const arManager = ARManager.getInstance();
arManager;
