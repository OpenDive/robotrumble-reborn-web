import * as jsAruco from 'js-aruco';

interface Corner {
  x: number;
  y: number;
}

export interface Marker {
  id: number;
  corners: Corner[];
  center: Corner;
}

/**
 * Wrapper for js-aruco marker detection
 */
export class MarkerDetector {
  private detector: any;
  private debugCanvas: HTMLCanvasElement;
  private debugCtx: CanvasRenderingContext2D;

  constructor() {
    try {
      // Create debug canvas
      this.debugCanvas = document.createElement('canvas');
      const ctx = this.debugCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Failed to get 2D context for debug canvas');
      this.debugCtx = ctx;

      // Initialize detector with debug mode
      const { AR } = jsAruco;
      this.detector = new AR.Detector();

      // Set up debug canvas size
      this.debugCanvas.width = 640;  // Initial size, will be updated with frame
      this.debugCanvas.height = 480;

      
      console.log('MarkerDetector: Initialized with options', {
        detector: this.detector ? 'created' : 'failed',
        debug: true,
        maxHammingDistance: 2
      });
    } catch (error) {
      console.error('MarkerDetector: Failed to initialize:', error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    // Nothing to initialize asynchronously
    return Promise.resolve();
  }

  /**
   * Detect markers in the current video frame
   */
  detectMarkers(imageData: ImageData): Marker[] {
    if (!imageData) {
      console.warn('MarkerDetector: No image data provided');
      return [];
    }

    // Validate image data
    const validationResult = this.validateImageData(imageData);
    if (!validationResult.valid) {
      console.warn('MarkerDetector: Invalid image data:', validationResult.reason);
      return [];
    }

    // Update debug canvas size if needed
    if (this.debugCanvas.width !== imageData.width || this.debugCanvas.height !== imageData.height) {
      this.debugCanvas.width = imageData.width;
      this.debugCanvas.height = imageData.height;
    }

    // Draw frame to debug canvas for visualization
    this.debugCtx.putImageData(imageData, 0, 0);

    // Log detailed frame data periodically
    if (Math.random() < 0.016) { // Log roughly every 60 frames
      const stats = this.analyzeImageData(imageData);
      console.log('MarkerDetector: Frame Analysis', stats);
    }

    // Convert to grayscale first, then downsample
    const grayscaleData = this.convertToGrayscale(imageData);
    const processedData = this.downsampleImage(grayscaleData, 640, 480);
    
    // Log processed data periodically
    if (Math.random() < 0.016) {
      console.log('MarkerDetector: Processed image', {
        original: { width: imageData.width, height: imageData.height },
        processed: { width: processedData.width, height: processedData.height },
        samplePixels: Array.from(processedData.data.slice(0, 16))
      });
    }

    // Log detector state
    if (Math.random() < 0.016) {
      const detectorInfo = {
        threshold: (this.detector as any).threshold,
        errorCorrectionRate: (this.detector as any).errorCorrectionRate,
        debug: (this.detector as any).debug,
        width: grayscaleData.width,
        height: grayscaleData.height,
        dataType: grayscaleData.data.constructor.name,
        dataRange: {
          min: Math.min(...grayscaleData.data),
          max: Math.max(...grayscaleData.data)
        }
      };
      console.log('MarkerDetector: Detailed detector state', detectorInfo);
    }

    // Detect markers
    const markers = this.detector.detect(processedData);

    // Log detector input/output periodically
    if (Math.random() < 0.016) {
      console.log('MarkerDetector: Detector details', {
        inputValid: processedData && processedData.data && processedData.data.length > 0,
        detector: this.detector ? 'present' : 'missing',
        detectorProps: Object.keys(this.detector || {}),
        markerCount: markers?.length || 0
      });
    }

    // Draw debug visualization
    if (markers.length > 0) {
      this.debugCtx.strokeStyle = '#00ff00';
      this.debugCtx.lineWidth = 2;

      markers.forEach((marker: any) => {
        // Draw marker outline
        this.debugCtx.beginPath();
        marker.corners.forEach((corner: Corner, i: number) => {
          const x = corner?.x || 0;
          const y = corner?.y || 0;
          if (i === 0) this.debugCtx.moveTo(x, y);
          else this.debugCtx.lineTo(x, y);
        });
        this.debugCtx.closePath();
        this.debugCtx.stroke();

        // Draw marker ID
        const center = this.calculateCenter(marker.corners);
        this.debugCtx.fillStyle = '#00ff00';
        this.debugCtx.font = '16px Arial';
        this.debugCtx.fillText(`ID: ${marker.id}`, center.x, center.y);
      });
    }

    // Convert to our marker format
    return markers.map((marker: any) => ({
      id: marker.id,
      corners: marker.corners.map((corner: Corner) => ({
        x: corner.x || 0,
        y: corner.y || 0
      })),
      center: this.calculateCenter(marker.corners)
    }));
  }

  private validateImageData(imageData: ImageData): { valid: boolean; reason?: string } {
    // Check dimensions
    if (imageData.width <= 0 || imageData.height <= 0) {
      return { valid: false, reason: 'Invalid dimensions' };
    }

    // Check data array
    if (!imageData.data || imageData.data.length !== imageData.width * imageData.height * 4) {
      return { valid: false, reason: 'Invalid data array length' };
    }

    // Check if image is completely black or white
    const stats = this.analyzeImageData(imageData);
    if (stats.isMonochrome) {
      return { valid: false, reason: 'Image is monochrome: ' + stats.averageBrightness };
    }

    return { valid: true };
  }

  private analyzeImageData(imageData: ImageData) {
    let sum = 0;
    let min = 255;
    let max = 0;
    let blackPixels = 0;
    let whitePixels = 0;

    // Sample every 10th pixel for performance
    for (let i = 0; i < imageData.data.length; i += 40) {
      const value = imageData.data[i];
      sum += value;
      min = Math.min(min, value);
      max = Math.max(max, value);
      if (value < 10) blackPixels++;
      if (value > 245) whitePixels++;
    }

    const sampledPixels = Math.floor(imageData.data.length / 40);
    const averageBrightness = sum / sampledPixels;
    const isMonochrome = (max - min) < 20;

    return {
      width: imageData.width,
      height: imageData.height,
      averageBrightness: Math.round(averageBrightness),
      min,
      max,
      contrast: max - min,
      blackPixelPercentage: (blackPixels / sampledPixels) * 100,
      whitePixelPercentage: (whitePixels / sampledPixels) * 100,
      isMonochrome,
      sampleSize: sampledPixels,
      firstPixels: Array.from(imageData.data.slice(0, 16))
    };
  }

  private downsampleImage(imageData: ImageData, targetWidth: number, targetHeight: number): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) {
      console.error('Failed to get 2D context for downsampling');
      return imageData;
    }

    // Create a temporary canvas to draw the original image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      console.error('Failed to get 2D context for temp canvas');
      return imageData;
    }

    // Draw original image data
    tempCtx.putImageData(imageData, 0, 0);

    // Draw and scale down
    ctx.drawImage(tempCanvas, 0, 0, imageData.width, imageData.height, 0, 0, targetWidth, targetHeight);

    // Get the downsampled image data
    return ctx.getImageData(0, 0, targetWidth, targetHeight);
  }

  private convertToGrayscale(imageData: ImageData): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const grayscaleArray = new Uint8ClampedArray(width * height * 4);
    
    // Process 4 bytes (RGBA) at a time
    for (let i = 0; i < imageData.data.length; i += 4) {
      // Convert to grayscale using luminosity method
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      
      // Set all RGB channels to grayscale value (not inverted)
      grayscaleArray[i] = gray;
      grayscaleArray[i + 1] = gray;
      grayscaleArray[i + 2] = gray;
      grayscaleArray[i + 3] = 255; // Full alpha
    }
    
    return new ImageData(grayscaleArray, width, height);
  }

  private calculateCenter(corners: Corner[]): Corner {
    if (!corners?.length) {
      return { x: 0, y: 0 };
    }
    return {
      x: corners.reduce((sum, corner) => sum + (corner?.x || 0), 0) / corners.length,
      y: corners.reduce((sum, corner) => sum + (corner?.y || 0), 0) / corners.length
    };
  }
}
