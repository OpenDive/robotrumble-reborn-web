

interface DebugCanvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tempCanvas: HTMLCanvasElement;
  tempCtx: CanvasRenderingContext2D;
}

export class DebugManager {
  private static instance: DebugManager;
  private markerDebugCanvas: DebugCanvas | null = null;
  private constructor() {}

  static getInstance(): DebugManager {
    if (!DebugManager.instance) {
      DebugManager.instance = new DebugManager();
    }
    return DebugManager.instance;
  }

  getMarkerDebugCanvas(): DebugCanvas {
    if (!this.markerDebugCanvas) {
      // Create main debug canvas
      const canvas = document.createElement('canvas');
      canvas.style.position = 'fixed';
      canvas.style.bottom = '10px';
      canvas.style.right = '10px';
      canvas.style.border = '2px solid red';
      canvas.style.zIndex = '1000';
      canvas.width = 320;  // Quarter size for debug
      canvas.height = 180;

      const ctx = canvas.getContext('2d', {
        willReadFrequently: true
      });
      if (!ctx) {
        throw new Error('Failed to get 2D context for marker debug canvas');
      }

      // Create reusable temporary canvas for image processing
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d', {
        willReadFrequently: true
      });
      if (!tempCtx) {
        throw new Error('Failed to get 2D context for temporary canvas');
      }

      this.markerDebugCanvas = { canvas, ctx, tempCanvas, tempCtx };
      document.body.appendChild(canvas);
    }

    return this.markerDebugCanvas;
  }

  dispose(): void {
    if (this.markerDebugCanvas) {
      if (this.markerDebugCanvas.canvas.parentElement) {
        this.markerDebugCanvas.canvas.remove();
      }
      this.markerDebugCanvas = null;
    }
  }
}

export const debugManager = DebugManager.getInstance();
