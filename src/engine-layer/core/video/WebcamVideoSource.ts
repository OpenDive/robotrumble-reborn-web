import { IVideoSource, VideoStats, VideoConfig, VideoConnectionState } from './types';

/**
 * Implementation of VideoSource using the device's webcam
 */
export class WebcamVideoSource implements IVideoSource {
  private video: HTMLVideoElement;
  private stream: MediaStream | null;
  private dimensions: { width: number; height: number };
  private lastFrameTime: number = 0;
  private fps: number = 0;
  private connectionState: VideoConnectionState = 'disconnected';
  private lastError?: string;
  private isActive: boolean;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private setupFPSCalculation(): void {
    // Update FPS every second
    setInterval(() => {
      const now = performance.now();
      if (this.lastFrameTime) {
        this.fps = 1000 / (now - this.lastFrameTime);
      }
      this.lastFrameTime = now;
    }, 1000);
  }

  constructor() {
    // Create video element for THREE.js texture
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.style.display = 'none';
    document.body.appendChild(this.video); // Needed for iOS
    
    console.log('WebcamVideoSource: Created video element', {
      playsInline: this.video.playsInline,
      muted: this.video.muted,
      autoplay: this.video.autoplay,
      inDOM: document.body.contains(this.video)
    });

    // Create canvas and context for frame capture
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    
    console.log('WebcamVideoSource: Created canvas', {
      width: this.canvas.width,
      height: this.canvas.height,
      context: ctx ? 'available' : 'null'
    });

    this.stream = null;
    this.dimensions = { width: 1280, height: 720 }; // Default HD resolution
    this.isActive = false;

    // Set initial canvas size
    this.canvas.width = this.dimensions.width;
    this.canvas.height = this.dimensions.height;

    // Setup FPS calculation
    this.setupFPSCalculation();
  }

  async initialize(config?: VideoConfig): Promise<void> {
    try {
      this.connectionState = 'connecting';
      
      // Apply config if provided
      if (config?.webcam) {
        this.dimensions = {
          width: config.webcam.width || this.dimensions.width,
          height: config.webcam.height || this.dimensions.height
        };
      }
      console.log('WebcamVideoSource: Starting initialization...');
      console.log('WebcamVideoSource: Requesting camera access...', {
        requested: {
          width: this.dimensions.width,
          height: this.dimensions.height
        }
      });

      // Get camera stream
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: this.dimensions.width },
          height: { ideal: this.dimensions.height },
        },
        audio: false
      });

      // Set video source
      this.video.srcObject = this.stream;
      console.log('WebcamVideoSource: Camera access granted', {
        tracks: this.stream.getVideoTracks().map(track => ({
          label: track.label,
          settings: track.getSettings()
        })),
        video: {
          srcObject: this.video.srcObject ? 'set' : 'null',
          readyState: this.video.readyState,
          paused: this.video.paused,
          currentTime: this.video.currentTime
        }
      });
      
      // Wait for video metadata to load
      await new Promise<void>((resolve) => {
        this.video.onloadedmetadata = () => {
          console.log('WebcamVideoSource: Video metadata loaded', {
            video: {
              width: this.video.videoWidth,
              height: this.video.videoHeight,
              readyState: this.video.readyState
            }
          });
          // Update dimensions and canvas size with actual video dimensions
          this.dimensions.width = this.video.videoWidth;
          this.dimensions.height = this.video.videoHeight;
          this.canvas.width = this.video.videoWidth;
          this.canvas.height = this.video.videoHeight;
          console.log('WebcamVideoSource: Updated canvas dimensions', {
            width: this.canvas.width,
            height: this.canvas.height
          });
          resolve();
        };
      });

      // Wait for first frame
      await new Promise<void>((resolve) => {
        this.video.onloadeddata = () => {
          console.log('WebcamVideoSource: First frame loaded');
          resolve();
        };
      });

      console.log('WebcamVideoSource: Initialization complete');
    } catch (error) {
      console.error('WebcamVideoSource: Failed to initialize:', error);
      throw error;
    }
  }

  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  // Get current frame for marker detection
  getCurrentFrame(): ImageData | null {
    if (!this.isActive || this.video.readyState !== this.video.HAVE_ENOUGH_DATA) {
      return null;
    }

    this.ctx.drawImage(this.video, 0, 0);
    return this.ctx.getImageData(0, 0, this.dimensions.width, this.dimensions.height);
  }

  /**
   * @deprecated Use getDimensions() instead
   */
  getWidth(): number {
    return this.dimensions.width;
  }

  /**
   * @deprecated Use getDimensions() instead
   */
  getHeight(): number {
    return this.dimensions.height;
  }

  async start(): Promise<void> {
    if (!this.stream) {
      throw new Error('Video source not initialized');
    }
    try {
      this.connectionState = 'connecting';
      console.log('Starting video playback...', {
        readyState: this.video.readyState,
        paused: this.video.paused,
        currentTime: this.video.currentTime,
        videoWidth: this.video.videoWidth,
        videoHeight: this.video.videoHeight
      });

      // Always try to play, even if not paused (might be in ended state)
      try {
        await this.video.play();
        console.log('Video playback started');
      } catch (error: unknown) {
        const playError = error instanceof Error ? error : new Error('Unknown video playback error');
        console.error('Failed to start video playback:', playError);
        this.connectionState = 'error';
        this.lastError = playError.message;
        throw playError;
      }

      // Wait for the first frame to be available
      await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 50; // 50 frames = ~1 second at 60fps

        const checkVideo = () => {
          attempts++;
          if (this.video.readyState >= 2) { // HAVE_CURRENT_DATA or better
            console.log('First video frame available', {
              readyState: this.video.readyState,
              videoWidth: this.video.videoWidth,
              videoHeight: this.video.videoHeight
            });
            this.isActive = true;
            this.connectionState = 'connected';
            resolve();
          } else if (attempts >= maxAttempts) {
            const error = new Error('Timeout waiting for video frame');
            this.connectionState = 'error';
            this.lastError = error.message;
            reject(error);
          } else {
            requestAnimationFrame(checkVideo);
          }
        };
        checkVideo();
      });
    } catch (error: unknown) {
      const startError = error instanceof Error ? error : new Error('Unknown video start error');
      console.error('Failed to start video:', startError);
      this.connectionState = 'error';
      this.lastError = startError.message;
      throw startError;
    }
  }

  async stop(): Promise<void> {
    // Stop all video tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    // Clear video source
    this.video.srcObject = null;
    this.isActive = false;
  }

  isReady(): boolean {
    return this.isActive && this.connectionState === 'connected';
  }

  getStats(): VideoStats {
    return {
      latency: 0, // Local camera has negligible latency
      fps: this.fps,
      connectionState: this.connectionState,
      lastError: this.lastError
    };
  }

  // Use isReady() instead of isStreaming() for consistency with IVideoSource interface

  getDimensions(): { width: number; height: number } {
    return { ...this.dimensions };
  }
}
