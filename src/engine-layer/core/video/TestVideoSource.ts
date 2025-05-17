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
    this.video.preload = 'auto';

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
      console.log('TestVideoSource: Initializing...', config);

      if (!config?.test?.videoPath) {
        throw new Error('Video path not provided');
      }

      // Reset video element and state
      this.isActive = false;
      this.lastError = undefined;
      
      // Clean up existing video element
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
      
      // Remove all event listeners
      this.video.onloadedmetadata = null;
      this.video.onloadeddata = null;
      this.video.onplay = null;
      this.video.onpause = null;
      this.video.onerror = null;

      // Set up video event listeners before setting source
      const videoReady = new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          this.video.removeEventListener('loadeddata', handleLoadedData);
          this.video.removeEventListener('error', handleError);
        };

        const handleLoadedData = () => {
          console.log('TestVideoSource: Video data loaded', {
            readyState: this.video.readyState,
            size: { width: this.video.videoWidth, height: this.video.videoHeight }
          });
          cleanup();
          resolve();
        };

        const handleError = (e: ErrorEvent) => {
          const errorMessage = this.video.error?.message || 'Unknown error';
          console.error('TestVideoSource: Video load error', {
            error: errorMessage,
            event: e
          });
          cleanup();
          reject(new Error('Failed to load video: ' + errorMessage));
        };

        this.video.addEventListener('loadeddata', handleLoadedData);
        this.video.addEventListener('error', handleError);
      });

      // Set video properties
      console.log('TestVideoSource: Setting video source...', {
        path: config.test.videoPath
      });
      this.video.src = config.test.videoPath;
      this.video.loop = config.test.loop ?? true;

      // Wait for video to be ready
      console.log('TestVideoSource: Waiting for video to load...');
      await videoReady;

      // Update dimensions
      this.dimensions.width = this.video.videoWidth;
      this.dimensions.height = this.video.videoHeight;
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;

      console.log('TestVideoSource: Initialization complete', {
        dimensions: this.dimensions,
        loop: this.video.loop,
        readyState: this.video.readyState,
        videoElement: {
          src: this.video.src ? 'set' : 'empty',
          currentTime: this.video.currentTime,
          paused: this.video.paused,
          ended: this.video.ended
        }
      });

      this.connectionState = 'connected';
    } catch (error) {
      console.error('TestVideoSource: Initialization failed', error);
      this.connectionState = 'error';
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  async start(): Promise<void> {
    try {
      console.log('TestVideoSource: Starting playback...');
      
      // Ensure video is ready to play
      if (this.video.readyState < this.video.HAVE_ENOUGH_DATA) {
        console.log('TestVideoSource: Waiting for enough data...');
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Timeout waiting for video data'));
          }, 5000); // 5 second timeout

          const cleanup = () => {
            clearTimeout(timeout);
            this.video.removeEventListener('canplay', handleCanPlay);
            this.video.removeEventListener('error', handleError);
          };

          const handleCanPlay = () => {
            cleanup();
            resolve();
          };

          const handleError = () => {
            const errorMessage = this.video.error?.message || 'Unknown error';
            cleanup();
            reject(new Error('Video failed to load: ' + errorMessage));
          };

          this.video.addEventListener('canplay', handleCanPlay);
          this.video.addEventListener('error', handleError);
        });
      }

      // Start playback and wait for confirmation
      console.log('TestVideoSource: Attempting to play video...');
      const playPromise = this.video.play();
      if (playPromise) {
        await playPromise;
      }

      // Wait for the first frame to be actually playing
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Timeout waiting for video playback'));
        }, 5000); // 5 second timeout

        const cleanup = () => {
          clearTimeout(timeout);
          this.video.removeEventListener('timeupdate', handleTimeUpdate);
          this.video.removeEventListener('error', handleError);
        };

        const handleTimeUpdate = () => {
          if (this.video.currentTime > 0) {
            cleanup();
            resolve();
          }
        };

        const handleError = () => {
          const errorMessage = this.video.error?.message || 'Unknown error';
          cleanup();
          reject(new Error('Video playback failed: ' + errorMessage));
        };

        this.video.addEventListener('timeupdate', handleTimeUpdate);
        this.video.addEventListener('error', handleError);
      });
      
      this.isActive = true;
      console.log('TestVideoSource: Playback started successfully', {
        readyState: this.video.readyState,
        currentTime: this.video.currentTime,
        paused: this.video.paused,
        videoWidth: this.video.videoWidth,
        videoHeight: this.video.videoHeight
      });
    } catch (error) {
      console.error('TestVideoSource: Failed to start playback', error);
      this.connectionState = 'error';
      this.lastError = error instanceof Error ? error.message : 'Failed to start video';
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log('TestVideoSource: Stopping...');
    
    // Pause video and reset state
    this.video.pause();
    this.video.currentTime = 0;
    
    // Clean up video element
    this.video.removeAttribute('src');
    this.video.load();
    
    // Remove all event listeners
    this.video.onloadedmetadata = null;
    this.video.onloadeddata = null;
    this.video.onplay = null;
    this.video.onpause = null;
    this.video.onerror = null;
    
    // Reset state
    this.isActive = false;
    this.connectionState = 'disconnected';
    this.lastError = undefined;
    
    console.log('TestVideoSource: Stopped');
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

  shouldMirrorDisplay(): boolean {
    return false;
  }
} 