declare module 'js-aruco' {
    namespace AR {
        interface MarkerCorners {
            x: number;
            y: number;
        }

        interface DetectedMarker {
            id: number;
            corners: MarkerCorners[];
        }

        class Detector {
            constructor();
            detect(imageData: ImageData): DetectedMarker[];
        }

        class Marker {
            constructor(id: number, corners: MarkerCorners[]);
            id: number;
            corners: MarkerCorners[];
        }
    }

    export const AR: typeof AR;
    export const CV: any;
    export const SVD: any;
    export const POS1: any;
    export const POS2: any;
}
