declare module 'js-aruco' {
    export interface MarkerCorners {
        x: number;
        y: number;
    }

    export interface DetectedMarker {
        id: number;
        corners: MarkerCorners[];
    }

    export class Detector {
        constructor();
        detect(imageData: ImageData): DetectedMarker[];
    }
}
