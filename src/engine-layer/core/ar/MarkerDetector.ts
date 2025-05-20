import jsAruco from 'js-aruco';
import { debugManager } from '../debug/DebugManager';
import { debugLogger } from '../debug/DebugLogger';
import { IVideoSource } from '../video/types';

export interface Marker {
  id: number;
  corners: { x: number; y: number }[];
  center: { x: number; y: number };
  pose?: {
    bestError: number;
    bestRotation: number[][];
    bestTranslation: number[];
    alternativeError: number;
    alternativeRotation: number[][];
    alternativeTranslation: number[];
  };
}

/**
 * Wrapper for js-aruco marker detection
 */
export class MarkerDetector {
  private detector: jsAruco.AR.Detector;
  private posit: any; // jsAruco.POS1.Posit
  private debugCanvas: HTMLCanvasElement | null = null;
  private debugCtx: CanvasRenderingContext2D | null = null;
  private tempCanvas: HTMLCanvasElement | null = null;
  private tempCtx: CanvasRenderingContext2D | null = null;
  private readonly MARKER_SIZE_MM = 50; // Physical marker size in millimeters

  constructor() {
    debugLogger.log('ar', 'MarkerDetector: Initializing...', { jsAruco: !!jsAruco, AR: !!(jsAruco?.AR) });
    try {
      // @ts-ignore - js-aruco types are not properly defined
      this.detector = new jsAruco.AR.Detector();
      debugLogger.log('ar', 'MarkerDetector: Successfully created detector');
      
      // Initialize POSIT with marker size and default focal length
      // We'll update the focal length when we get the actual video dimensions
      // @ts-ignore - js-aruco types are not properly defined
      this.posit = new jsAruco.POS1.Posit(this.MARKER_SIZE_MM, 640);
      debugLogger.log('ar', 'MarkerDetector: Successfully created POSIT estimator');
      
      // Get debug canvas from DebugManager
      const { canvas, ctx, tempCanvas, tempCtx } = debugManager.getMarkerDebugCanvas();
      this.debugCanvas = canvas;
      this.debugCtx = ctx;
      this.tempCanvas = tempCanvas;
      this.tempCtx = tempCtx;
    } catch (error) {
      debugLogger.error('ar', 'MarkerDetector: Failed to create detector:', error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Update video source and reset debug visualization
   */
  async updateVideoSource(newSource: IVideoSource): Promise<void> {
    debugLogger.log('ar', 'MarkerDetector: Updating video source');
    
    // Get fresh debug canvases
    const { canvas, ctx, tempCanvas, tempCtx } = debugManager.getMarkerDebugCanvas();
    
    // Update internal references
    this.debugCanvas = canvas;
    this.debugCtx = ctx;
    this.tempCanvas = tempCanvas;
    this.tempCtx = tempCtx;
    
    // Get dimensions from new source
    const videoElement = newSource.getVideoElement();
    const { width, height } = newSource.getDimensions();
    
    // Update canvas dimensions
    this.tempCanvas!.width = width;
    this.tempCanvas!.height = height;
    
    // Clear any existing content
    if (this.debugCtx) {
      this.debugCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (this.tempCtx) {
      this.tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    }

    // Update POSIT focal length based on new dimensions
    // @ts-ignore - js-aruco types are not properly defined
    this.posit = new jsAruco.POS1.Posit(this.MARKER_SIZE_MM, width);

    debugLogger.log('ar', 'MarkerDetector: Debug canvases reset and dimensions updated', {
      width,
      height,
      videoReady: videoElement.readyState
    });
  }

  /**
   * Detect markers in the current video frame
   */
  detectMarkers(imageData: ImageData): Marker[] {
    try {

      debugLogger.log('ar', 'MarkerDetector: Processing frame', {
        width: imageData.width,
        height: imageData.height,
        dataLength: imageData.data.length,
        firstPixels: Array.from(imageData.data.slice(0, 16)), // Show first few pixels
        dataType: imageData.data.constructor.name
      });

      // Update POSIT focal length based on image width
      // @ts-ignore - js-aruco types are not properly defined
      this.posit = new jsAruco.POS1.Posit(this.MARKER_SIZE_MM, imageData.width);

      // Debug visualization
      if (this.debugCtx && this.debugCanvas && this.tempCtx && this.tempCanvas) {
        try {
          // Scale down for debug view
          this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
          this.debugCtx.save();
          this.debugCtx.scale(
            this.debugCanvas.width / imageData.width,
            this.debugCanvas.height / imageData.height
          );
          
          // Use reusable temp canvas for image processing
          if (this.tempCanvas.width !== imageData.width) this.tempCanvas.width = imageData.width;
          if (this.tempCanvas.height !== imageData.height) this.tempCanvas.height = imageData.height;
          
          this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
          this.tempCtx.putImageData(imageData, 0, 0);
          
          // Draw original image
          this.debugCtx.drawImage(this.tempCanvas, 0, 0);
          this.debugCtx.restore();

          // Add debug info
          this.debugCtx.fillStyle = 'red';
          this.debugCtx.font = '12px monospace';
          this.debugCtx.fillText(`Frame: ${imageData.width}x${imageData.height}`, 5, 15);
        } catch (error) {
          debugLogger.error('ar', 'MarkerDetector: Error in debug visualization', error);
          // Clear both canvases on error
          this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
          this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
        }
      }

      // Detect markers
      const markers = this.detector.detect(imageData);
      
      // Debug visualization of detected markers
      if (this.debugCtx && markers.length > 0) {
        this.debugCtx.strokeStyle = 'lime';
        this.debugCtx.lineWidth = 2;
        const scale = this.debugCanvas!.width / imageData.width;
        
        markers.forEach(marker => {
          this.debugCtx!.beginPath();
          marker.corners.forEach((corner, idx) => {
            const x = corner.x * scale;
            const y = corner.y * scale;
            if (idx === 0) {
              this.debugCtx!.moveTo(x, y);
            } else {
              this.debugCtx!.lineTo(x, y);
            }
          });
          this.debugCtx!.closePath();
          this.debugCtx!.stroke();
          
          // Draw ID
          const centerX = marker.corners.reduce((sum, c) => sum + c.x, 0) / 4 * scale;
          const centerY = marker.corners.reduce((sum, c) => sum + c.y, 0) / 4 * scale;
          this.debugCtx!.fillStyle = 'lime';
          this.debugCtx!.fillText(`ID: ${marker.id}`, centerX, centerY);
        });
      }

      debugLogger.log('ar', 'Detection result', {
        markersFound: markers.length,
        firstMarker: markers.length > 0 ? {
          id: markers[0].id,
          cornerCount: markers[0].corners.length,
          corners: markers[0].corners
        } : null
      });

      // Convert to our marker format and calculate pose
      return markers.map((marker: jsAruco.DetectedMarker) => {
        const corners = marker.corners.map((corner: jsAruco.MarkerCorners) => ({
          x: corner.x,
          y: corner.y
        }));

        // Center the corners for POSIT
        const centeredCorners = corners.map(corner => ({
          x: corner.x - (imageData.width / 2),
          y: (imageData.height / 2) - corner.y
        }));

        // Calculate pose using POSIT
        let pose;
        try {
          pose = this.posit.pose(centeredCorners);
          debugLogger.log('ar', 'Pose calculated', {
            markerId: marker.id,
            bestError: pose.bestError,
            bestTranslation: pose.bestTranslation,
            bestRotation: pose.bestRotation
          });
        } catch (error) {
          debugLogger.error('ar', 'Failed to calculate pose:', error);
        }

        return {
          id: marker.id,
          corners: corners,
          center: {
            x: corners.reduce((sum, corner) => sum + corner.x, 0) / 4,
            y: corners.reduce((sum, corner) => sum + corner.y, 0) / 4
          },
          pose: pose
        };
      });
    } catch (error) {
      debugLogger.error('ar', 'MarkerDetector: Detection failed:', error);
      return [];
    }
  }
}
