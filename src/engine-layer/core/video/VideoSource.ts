/**
 * Interface for video sources (webcam, WebRTC stream, etc.)
 */
export interface VideoSource {
  /**
   * Initialize the video source and request necessary permissions
   */
  initialize(): Promise<void>;

  /**
   * Get the HTMLVideoElement that can be used as a texture source
   */
  getVideoElement(): HTMLVideoElement;

  /**
   * Start streaming video from the source
   */
  start(): Promise<void>;

  /**
   * Stop streaming video and cleanup resources
   */
  stop(): void;

  /**
   * Check if the video source is currently streaming
   */
  isStreaming(): boolean;

  /**
   * Get video dimensions
   */
  getDimensions(): { width: number; height: number };
}
