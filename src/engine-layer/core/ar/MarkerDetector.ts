import jsAruco from 'js-aruco';

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

  constructor() {
    // @ts-ignore - js-aruco types are not properly defined
    this.detector = new jsAruco.AR.Detector();
  }

  async initialize(): Promise<void> {
    // Nothing to initialize asynchronously
    return Promise.resolve();
  }

  /**
   * Detect markers in the current video frame
   */
  detectMarkers(imageData: ImageData): Marker[] {
    // Detect markers directly from the provided ImageData
    const markers = this.detector.detect(imageData);

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
