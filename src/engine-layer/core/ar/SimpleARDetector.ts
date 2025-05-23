import * as THREE from 'three';
import jsAruco from 'js-aruco';

export interface DetectedMarker {
  id: number;
  corners: { x: number; y: number }[];
  center: { x: number; y: number };
  pose?: {
    bestTranslation: number[];      // Raw [x, y, z] array like MarkerDetector
    bestRotation: number[][];       // Raw 3x3 matrix like MarkerDetector  
    bestError: number;              // Raw error value
  };
}

/**
 * Simplified AR marker detector for direct HTMLVideoElement integration
 */
export class SimpleARDetector {
  private detector: any; // jsAruco.AR.Detector
  private posit: any; // jsAruco.POS1.Posit
  private extractionCanvas: HTMLCanvasElement;
  private extractionCtx: CanvasRenderingContext2D;
  private readonly MARKER_SIZE_MM = 50; // Physical marker size in millimeters
  private isInitialized = false;

  constructor() {
    // Create hidden canvas for ImageData extraction
    this.extractionCanvas = document.createElement('canvas');
    this.extractionCtx = this.extractionCanvas.getContext('2d')!;
    this.extractionCanvas.style.display = 'none';
    document.body.appendChild(this.extractionCanvas);
  }

  async initialize(): Promise<void> {
    try {
      // Check if js-aruco is available
      if (typeof jsAruco === 'undefined') {
        throw new Error('js-aruco library not loaded');
      }

      // Initialize detector
      // @ts-ignore - js-aruco types are not properly defined
      this.detector = new jsAruco.AR.Detector();
      
      // Initialize POSIT with default values (will update based on video dimensions)
      // @ts-ignore - js-aruco types are not properly defined
      this.posit = new jsAruco.POS1.Posit(this.MARKER_SIZE_MM, 640);
      
      this.isInitialized = true;
      console.log('SimpleARDetector: Initialized successfully');
    } catch (error) {
      console.error('SimpleARDetector: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Detect markers in the current video frame
   */
  detectMarkers(videoElement: HTMLVideoElement): DetectedMarker[] {
    if (!this.isInitialized || !this.detector) {
      console.warn('SimpleARDetector: Not initialized');
      return [];
    }

    if (videoElement.readyState < 2) {
      // Video not ready
      return [];
    }

    try {
      // Extract ImageData from video
      const imageData = this.extractImageData(videoElement);
      if (!imageData) return [];

      // Update POSIT focal length based on video dimensions
      // @ts-ignore - js-aruco types are not properly defined
      this.posit = new jsAruco.POS1.Posit(this.MARKER_SIZE_MM, imageData.width);

      // Detect markers using js-aruco
      const rawMarkers = this.detector.detect(imageData);
      
      // Convert to our marker format
      return rawMarkers.map((rawMarker: any) => this.convertMarker(rawMarker, imageData));
    } catch (error) {
      console.error('SimpleARDetector: Detection failed:', error);
      return [];
    }
  }

  /**
   * Extract ImageData from video element
   */
  private extractImageData(videoElement: HTMLVideoElement): ImageData | null {
    try {
      const width = videoElement.videoWidth;
      const height = videoElement.videoHeight;

      if (width === 0 || height === 0) {
        return null;
      }

      // Update canvas size if needed
      if (this.extractionCanvas.width !== width || this.extractionCanvas.height !== height) {
        this.extractionCanvas.width = width;
        this.extractionCanvas.height = height;
      }

      // Draw video frame to canvas
      this.extractionCtx.drawImage(videoElement, 0, 0, width, height);
      
      // Extract ImageData
      return this.extractionCtx.getImageData(0, 0, width, height);
    } catch (error) {
      console.error('SimpleARDetector: Failed to extract ImageData:', error);
      return null;
    }
  }

  /**
   * Convert raw js-aruco marker to our format
   */
  private convertMarker(rawMarker: any, imageData: ImageData): DetectedMarker {
    // Extract corners
    const corners = rawMarker.corners.map((corner: any) => ({
      x: corner.x,
      y: corner.y
    }));

    // Calculate center
    const center = {
      x: corners.reduce((sum: number, corner: { x: number; y: number }) => sum + corner.x, 0) / 4,
      y: corners.reduce((sum: number, corner: { x: number; y: number }) => sum + corner.y, 0) / 4
    };

    // Calculate pose using POSIT
    let pose: DetectedMarker['pose'];
    try {
      // Center corners for POSIT (move origin to center, flip Y)
      const centeredCorners = corners.map((corner: { x: number; y: number }) => ({
        x: corner.x - (imageData.width / 2),
        y: (imageData.height / 2) - corner.y
      }));

      const rawPose = this.posit.pose(centeredCorners);
      
      console.log('POSIT raw result for marker', rawMarker.id, ':', rawPose);
      
      // Keep raw POSIT data (no conversion to Three.js types)
      pose = {
        bestTranslation: rawPose.bestTranslation,
        bestRotation: rawPose.bestRotation,
        bestError: rawPose.bestError
      };
      
      console.log('Stored pose data:', pose);
    } catch (error) {
      console.warn('SimpleARDetector: Failed to calculate pose for marker', rawMarker.id, error);
    }

    return {
      id: rawMarker.id,
      corners,
      center,
      pose
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.extractionCanvas && this.extractionCanvas.parentNode) {
      this.extractionCanvas.parentNode.removeChild(this.extractionCanvas);
    }
    this.isInitialized = false;
  }
} 