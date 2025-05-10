import { VideoSource } from '../video/VideoSource';
import * as jsAruco from 'js-aruco';

export interface Marker {
  id: number;
  corners: { x: number; y: number }[];
  center: { x: number; y: number };
}

/**
 * Wrapper for js-aruco marker detection
 */
export class MarkerDetector {
  private detector: jsAruco.Detector;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private imageData: ImageData;

  constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
    this.imageData = new ImageData(1, 1); // Placeholder until initialized
    this.detector = new jsAruco.Detector(); // Initialize detector in constructor
  }

  async initialize(): Promise<void> {
    // Nothing to initialize asynchronously
    return Promise.resolve();
  }

  /**
   * Detect markers in the current video frame
   */
  detectMarkers(videoSource: VideoSource): Marker[] {
    if (!videoSource.isStreaming()) {
      return [];
    }

    const video = videoSource.getVideoElement();
    const { width, height } = videoSource.getDimensions();

    // Resize canvas if needed
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.imageData = new ImageData(width, height);
    }

    // Draw current video frame to canvas
    this.ctx.drawImage(video, 0, 0);

    // Get image data for marker detection
    this.imageData = this.ctx.getImageData(0, 0, width, height);
    
    // Detect markers
    const markers = this.detector.detect(this.imageData);

    // Convert to our marker format
    return markers.map((marker: jsAruco.DetectedMarker) => ({
      id: marker.id,
      corners: marker.corners.map((corner: jsAruco.MarkerCorners) => ({
        x: corner.x,
        y: corner.y
      })),
      center: {
        x: marker.corners.reduce((sum: number, corner: jsAruco.MarkerCorners) => sum + corner.x, 0) / 4,
        y: marker.corners.reduce((sum: number, corner: jsAruco.MarkerCorners) => sum + corner.y, 0) / 4
      }
    }));
  }
}
