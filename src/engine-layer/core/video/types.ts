/**
 * Types for video source system
 */

export type VideoSourceType = 'webrtc' | 'webcam' | 'test-video';

export interface VideoStats {
  latency: number;          // Current latency in ms
  fps: number;             // Current frames per second
  connectionState: VideoConnectionState;
  lastError?: string;      // Last error message if any
}

export type VideoConnectionState = 
  | 'disconnected'  // Not connected to source
  | 'connecting'    // Connection in progress
  | 'connected'     // Successfully connected
  | 'error';        // Connection error

export interface VideoConfig {
  sourceType: VideoSourceType;
  webrtc?: {
    signalingUrl: string;
    iceServers: string[];
  };
  webcam?: {
    width?: number;
    height?: number;
    facingMode?: 'user' | 'environment';
  };
  test?: {
    videoPath: string;
    loop?: boolean;
    autoplay?: boolean;
  };
}

/**
 * Interface for video sources (webcam, WebRTC stream, test video)
 */
export interface IVideoSource {
  /**
   * Initialize the video source and request necessary permissions
   */
  initialize(config?: VideoConfig): Promise<void>;

  /**
   * Start streaming video from the source
   */
  start(): Promise<void>;

  /**
   * Stop streaming video and cleanup resources
   */
  stop(): Promise<void>;

  /**
   * Get the HTMLVideoElement that can be used as a texture source
   */
  getVideoElement(): HTMLVideoElement;

  /**
   * Get the current frame as ImageData for processing
   */
  getCurrentFrame(): ImageData | null;

  /**
   * Check if the video source is ready for streaming
   */
  isReady(): boolean;

  /**
   * Get current video source statistics
   */
  getStats(): VideoStats;

  /**
   * Get video dimensions
   */
  getDimensions(): { width: number; height: number };
}
