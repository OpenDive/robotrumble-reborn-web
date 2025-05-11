import { WebcamVideoSource } from './WebcamVideoSource';
import { TestVideoSource } from './TestVideoSource';
import type { VideoSourceType } from './types';
import { IVideoSource, VideoConfig } from './types';
import { arManager } from '../ar/ARManager';

/**
 * Factory for creating and managing video sources
 */
export class VideoSourceFactory {
  private static instance: VideoSourceFactory;
  private currentSource: IVideoSource | null = null;

  private constructor() {}

  static getInstance(): VideoSourceFactory {
    if (!VideoSourceFactory.instance) {
      VideoSourceFactory.instance = new VideoSourceFactory();
    }
    return VideoSourceFactory.instance;
  }

  /**
   * Create a video source of specified type
   */
  async createSource(config: VideoConfig): Promise<IVideoSource> {
    // Cleanup existing source if any
    await this.cleanup();

    switch (config.sourceType) {
      case 'webcam':
        this.currentSource = new WebcamVideoSource();
        break;
        
      case 'test-video':
        this.currentSource = new TestVideoSource();
        break;
        
      case 'webrtc':
        // Will implement WebRTCVideoSource later
        throw new Error('WebRTCVideoSource not implemented yet');
        
      default:
        throw new Error(`Unknown video source type: ${config.sourceType}`);
    }

    // Initialize the new source
    await this.currentSource.initialize(config);
    
    // Update ARManager with new source if it's already initialized
    if (arManager.getVideoSource()) {
      await arManager.updateVideoSource(this.currentSource);
    }
    
    return this.currentSource;
  }

  /**
   * Get current active video source
   */
  getCurrentSource(): IVideoSource | null {
    return this.currentSource;
  }

  /**
   * Switch to a different video source
   */
  async switchSource(config: VideoConfig): Promise<IVideoSource> {
    return this.createSource(config);
  }

  /**
   * Clean up current video source
   */
  private async cleanup(): Promise<void> {
    if (this.currentSource) {
      await this.currentSource.stop();
      this.currentSource = null;
    }
  }
}
