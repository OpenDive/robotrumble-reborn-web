import { IVideoSource, VideoStats, VideoConfig, VideoConnectionState } from './types';

export class TestVideoSource implements IVideoSource {
  private video: HTMLVideoElement;
  private dimensions: { width: number; height: number };
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isActive: boolean = false;
  private connectionState: VideoConnectionState = 'disconnected';
  private lastError?: string;
  private fps: number = 0;
  private lastFrameTime: number = 0;

  constructor() {
    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.autoplay = false;

    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;

    this.dimensions = { width: 1280, height: 720 };
    this.canvas.width = this.dimensions.width;
    this.canvas.height = this.dimensions.height;

    // Setup FPS calculation
    setInterval(() => {
      const now = performance.now();
      if (this.lastFrameTime) {
        this.fps = 1000 / (now - this.lastFrameTime);
      }
      this.lastFrameTime = now;
    }, 1000);
  }

  async initialize(config?: VideoConfig): Promise<void> {
    try {
      this.connectionState = 'connecting';

      if (config?.test?.videoPath) {
        this.video.src = config.test.videoPath;
        if (config.test.loop !== undefined) {
          this.video.loop = config.test.loop;
        }
      } else {
        throw new Error('Video path not provided');
      }

      // Wait for video metadata to load
      await new Promise<void>((resolve, reject) => {
        this.video.onloadedmetadata = () => {
          this.dimensions.width = this.video.videoWidth;
          this.dimensions.height = this.video.videoHeight;
          this.canvas.width = this.video.videoWidth;
          this.canvas.height = this.video.videoHeight;
          resolve();
        };
        this.video.onerror = () => reject(new Error('Failed to load video'));
      });

      this.connectionState = 'connected';
    } catch (error) {
      this.connectionState = 'error';
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      await this.video.play();
      this.isActive = true;
    } catch (error) {
      this.connectionState = 'error';
      this.lastError = error instanceof Error ? error.message : 'Failed to start video';
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.video.pause();
    this.video.currentTime = 0;
    this.isActive = false;
    this.connectionState = 'disconnected';
  }

  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  getCurrentFrame(): ImageData | null {
    if (!this.isActive || this.video.readyState !== this.video.HAVE_ENOUGH_DATA) {
      return null;
    }

    this.ctx.drawImage(this.video, 0, 0);
    return this.ctx.getImageData(0, 0, this.dimensions.width, this.dimensions.height);
  }

  isReady(): boolean {
    return this.isActive && this.connectionState === 'connected';
  }

  getStats(): VideoStats {
    return {
      latency: 0,
      fps: this.fps,
      connectionState: this.connectionState,
      lastError: this.lastError
    };
  }

  getDimensions(): { width: number; height: number } {
    return { ...this.dimensions };
  }
} 