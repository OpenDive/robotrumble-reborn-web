import { networkManager } from './core/NetworkManager';
import { arManager } from './core/ARManager';
import { detectionManager } from './core/DetectionManager';

// This will be our main engine class that the UI layer interacts with
export class GameEngine {
  private static instance: GameEngine;
  private constructor() {}

  static getInstance(): GameEngine {
    if (!GameEngine.instance) {
      GameEngine.instance = new GameEngine();
    }
    return GameEngine.instance;
  }

  initialize(container: HTMLElement): void {
    // Initialize AR system
    arManager.initialize(container);
    
    // Set up network connections
    networkManager.setupVideoStream();
    networkManager.setupControlChannel();
  }

  // Control methods that UI can call
  sendControlInput(input: { x: number; y: number }): void {
    networkManager.sendControlInput(input);
  }

  startRace(): void {
    // Start race logic
  }

  // Frame processing
  processVideoFrame(frame: ImageData): void {
    detectionManager.processFrame(frame);
    arManager.updateAROverlay(frame);
  }
}

// Export a singleton instance
export const engine = GameEngine.getInstance();
