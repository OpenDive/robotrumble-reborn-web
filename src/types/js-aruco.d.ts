declare module 'js-aruco' {
  export namespace AR {
    class Detector {
      constructor();
      detect(imageData: ImageData): any[];
    }
  }
  
  export namespace POS1 {
    class Posit {
      constructor(markerSize: number, focalLength: number);
      pose(corners: { x: number; y: number }[]): {
        bestError: number;
        bestRotation: number[][];
        bestTranslation: number[];
      };
    }
  }
} 