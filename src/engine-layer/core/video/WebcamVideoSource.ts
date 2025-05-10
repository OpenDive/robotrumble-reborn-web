import { VideoSource } from './VideoSource';

/**
 * Implementation of VideoSource using the device's webcam
 */
export class WebcamVideoSource implements VideoSource {
  private video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private dimensions = { width: 1280, height: 720 }; // Default HD resolution

  constructor() {
    this.video = document.createElement('video');
    this.video.playsInline = true; // Important for iOS
    this.video.muted = true;
  }

  async initialize(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: this.dimensions.width },
          height: { ideal: this.dimensions.height },
          facingMode: 'environment' // Prefer rear camera if available
        }
      });

      this.video.srcObject = this.stream;
      
      // Wait for video metadata to load to get actual dimensions
      await new Promise<void>((resolve) => {
        this.video.onloadedmetadata = () => {
          this.dimensions.width = this.video.videoWidth;
          this.dimensions.height = this.video.videoHeight;
          resolve();
        };
      });
    } catch (error) {
      console.error('Failed to initialize webcam:', error);
      throw error;
    }
  }

  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  async start(): Promise<void> {
    if (!this.stream) {
      throw new Error('Video source not initialized');
    }
    await this.video.play();
  }

  stop(): void {
    this.video.pause();
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  isStreaming(): boolean {
    return !!this.stream && !this.video.paused;
  }

  getDimensions(): { width: number; height: number } {
    return { ...this.dimensions };
  }
}
