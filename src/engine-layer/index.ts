import { networkManager } from './core/NetworkManager';
import { arManager } from './core/ar/ARManager';
import { detectionManager } from './core/DetectionManager';
import { VideoSourceFactory } from './core/video/VideoSourceFactory';
import { VideoConfig } from './core/video/types';

// This will be our main engine class that the UI layer interacts with
export class GameEngine {
  private static instance: GameEngine;
  private constructor() {}

  static getInstance(): GameEngine {
    if (!GameEngine.instance) {
      GameEngine.instance = new GameEngine();
    }
    return GameEngine.instance;
  }

  private initialized = false;
  private currentContainer: HTMLElement | null = null;

  async initialize(container: HTMLElement): Promise<void> {
    try {
      // If already initialized, just move the renderer to the new container
      if (this.initialized) {
        console.log('Engine already initialized, updating container...');
        if (this.currentContainer !== container) {
          arManager.updateContainer(container);
          this.currentContainer = container;
        }
        return;
      }

      console.log('Initializing engine...');

      // Initialize video source first
      const videoConfig: VideoConfig = {
        sourceType: 'webcam',
        webcam: {
          width: 1280,
          height: 720
        }
      };
      const videoSourceFactory = VideoSourceFactory.getInstance();
      await videoSourceFactory.createSource(videoConfig);
      
      // Initialize AR system with video source
      await arManager.initialize(container);
      this.currentContainer = container;
      console.log('AR system initialized');
      
      // Set up network connections only if using WebRTC
      if (videoConfig.sourceType === 'webrtc') {
        await networkManager.setupVideoStream();
        await networkManager.setupControlChannel();
        console.log('Network connections established');
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize engine:', error);
      throw error;
    }
  }

  // Control methods that UI can call
  sendControlInput(input: { x: number; y: number }): void {
    networkManager.sendControlInput(input);
  }

  async startRace(): Promise<void> {
    try {
      // Ensure video is playing
      const source = arManager.getVideoSource();
      const isVideoStreaming = source?.getStats().connectionState === 'connected' || false;
      if (!isVideoStreaming) {
        await source.start();
      }

      // Start marker detection
      const frame = source.getCurrentFrame();
      if (frame) {
        this.processVideoFrame(frame);
      }

      console.log('Race started');
    } catch (error) {
      console.error('Failed to start race:', error);
      throw error;
    }
  }

  // Frame processing
  processVideoFrame(frame: ImageData): void {
    detectionManager.processFrame(frame);
  }
}

// Export a singleton instance
export const engine = GameEngine.getInstance();
