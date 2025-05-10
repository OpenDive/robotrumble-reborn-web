import { VideoSource } from './VideoSource';

/**
 * Implementation of VideoSource using the device's webcam
 */
export class WebcamVideoSource implements VideoSource {
  private video: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dimensions = { width: 1280, height: 720 }; // Default HD resolution

  constructor() {
    this.video = document.createElement('video');
    this.video.playsInline = true; // Important for iOS
    this.video.muted = true;
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
  }

  async initialize(): Promise<void> {
    try {
      console.log('Requesting camera access...');
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: this.dimensions.width },
          height: { ideal: this.dimensions.height },
          facingMode: 'environment' // Prefer rear camera if available
        },
        audio: false
      });
      console.log('Camera access granted');

      this.video.srcObject = this.stream;
      
      // Wait for video metadata to load to get actual dimensions
      await new Promise<void>((resolve) => {
        this.video.onloadedmetadata = () => {
          console.log('Video metadata loaded:', {
            width: this.video.videoWidth,
            height: this.video.videoHeight
          });
          this.dimensions.width = this.video.videoWidth;
          this.dimensions.height = this.video.videoHeight;
          resolve();
        };
      });
      
      // Set canvas size to match video
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
      
      console.log('Video source initialized');
    } catch (error) {
      console.error('Failed to initialize webcam:', error);
      throw error;
    }
  }

  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  getCurrentFrame(): ImageData | null {
    if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
      this.ctx.drawImage(this.video, 0, 0);
      return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }
    return null;
  }

  getWidth(): number {
    return this.video.videoWidth;
  }

  getHeight(): number {
    return this.video.videoHeight;
  }

  async start(): Promise<void> {
    if (!this.stream) {
      throw new Error('Video source not initialized');
    }
    try {
      console.log('Starting video playback...');
      if (this.video.paused) {
        await this.video.play();
        console.log('Video playback started');
      }
      // Wait for the first frame to be available
      await new Promise<void>((resolve) => {
        const checkVideo = () => {
          if (this.video.readyState >= 2) { // HAVE_CURRENT_DATA or better
            console.log('First video frame available');
            resolve();
          } else {
            requestAnimationFrame(checkVideo);
          }
        };
        checkVideo();
      });
    } catch (error) {
      console.error('Failed to start video:', error);
      throw error;
    }
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
