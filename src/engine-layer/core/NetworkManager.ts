export class NetworkManager {
  private static instance: NetworkManager;
  private constructor() {}

  static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  // WebRTC connection for video streaming
  setupVideoStream(): void {
    // TODO: Implement WebRTC video streaming
  }

  // WebSocket for control messages
  setupControlChannel(): void {
    // TODO: Implement WebSocket control channel
  }

  // Send control input with target latency < 200ms
  sendControlInput(input: { x: number; y: number }): void {
    // TODO: Implement control input sending
    console.log('Sending control input:', input);
  }
}

export const networkManager = NetworkManager.getInstance();
