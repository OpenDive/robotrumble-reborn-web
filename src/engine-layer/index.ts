import { networkManager } from './core/NetworkManager';
import { arManager } from './core/ar/ARManager';
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

  async initialize(container: HTMLElement): Promise<void> {
    try {
      // Initialize AR system
      await arManager.initialize(container);
      console.log('AR system initialized');
      
      // Set up network connections
      await networkManager.setupVideoStream();
      await networkManager.setupControlChannel();
      console.log('Network connections established');
    } catch (error) {
      console.error('Failed to initialize engine:', error);
      throw error;
    }
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
  }
}

// Export a singleton instance
export const engine = GameEngine.getInstance();
