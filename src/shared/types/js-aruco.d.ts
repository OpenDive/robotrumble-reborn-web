declare module 'js-aruco' {
    export interface MarkerCorners {
        x: number;
        y: number;
    }

    export interface DetectedMarker {
        id: number;
        corners: MarkerCorners[];
        center?: { x: number; y: number };
    }

    export interface DetectorOptions {
        dictionaryName?: 'ARUCO' | 'ARUCO_MIP_36h12' | string;
        maxHammingDistance?: number;
    }

    export interface Dictionary {
        nBits: number;
        tau?: number;
        codeList: string[];
    }

    export namespace AR {
        class Detector {
            constructor(options?: DetectorOptions);
            detect(imageData: ImageData): DetectedMarker[];
            detect(width: number, height: number, data: Uint8ClampedArray): DetectedMarker[];
            detectStreamInit(width: number, height: number, callback: (image: ImageData, markers: DetectedMarker[]) => void): void;
            detectStream(data: Uint8ClampedArray): void;
        }

        class Dictionary {
            constructor(dictionaryName: string);
            generateSVG(id: number): string;
        }
    }

    export const DICTIONARIES: {
        [key: string]: Dictionary;
        ARUCO: Dictionary;
        ARUCO_MIP_36h12: Dictionary;
    };
}
