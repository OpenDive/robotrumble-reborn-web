import { WebcamVideoSource } from './WebcamVideoSource';
import { TestVideoSource } from './TestVideoSource';
import type { VideoSourceType } from './types';
import { IVideoSource, VideoConfig } from './types';
import { arManager } from '../ar/ARManager';
import { debugLogger } from '../debug/DebugLogger';

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
    debugLogger.log('video', 'Creating new source...', { type: config.sourceType });
    
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
    debugLogger.log('video', 'Initializing new source...');
    await this.currentSource.initialize(config);
    
    // Update ARManager with new source if it's already initialized
    if (arManager.getVideoSource()) {
      debugLogger.log('video', 'Updating ARManager with new source...');
      await arManager.updateVideoSource(this.currentSource);
    }
    
    debugLogger.log('video', 'Source creation complete');
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
    debugLogger.log('video', 'Switching source...', { 
      from: this.currentSource?.constructor.name,
      to: config.sourceType 
    });
    return this.createSource(config);
  }

  /**
   * Clean up current video source
   */
  private async cleanup(): Promise<void> {
    if (this.currentSource) {
      debugLogger.log('video', 'Cleaning up current source...');
      
      // Get video element before stopping
      const videoElement = this.currentSource.getVideoElement();
      
      // Stop the source
      await this.currentSource.stop();
      
      // Clean up video element
      if (videoElement) {
        debugLogger.log('video', 'Cleaning up video element...');
        videoElement.pause();
        videoElement.srcObject = null;
        videoElement.src = '';
        videoElement.load(); // Reset video element state
        
        // Remove any event listeners (source should handle this, but just in case)
        videoElement.onloadedmetadata = null;
        videoElement.onloadeddata = null;
        videoElement.onplay = null;
        videoElement.onpause = null;
        videoElement.onerror = null;
      }
      
      this.currentSource = null;
      debugLogger.log('video', 'Cleanup complete');
    }
  }
}
