/**
 * Robot WebSocket service for controlling robots via signalling server
 * Based on Hurricane Labs WebSocketService but adapted for TypeScript and robot control
 */

export interface RobotFeedback {
  imu?: {
    orientation: { x: number; y: number; z: number };
    angular_velocity: { x: number; y: number; z: number };
    linear_acceleration: { x: number; y: number; z: number };
  };
  velocity?: {
    linear: { x: number; y: number };
    angular: { z: number };
  };
  position?: { x: number; y: number };
  robotName?: string;
  lastUpdate?: Date;
}

export interface RobotCommand {
  id: string;
  timestamp: string;
  command: string;
  status: 'sent' | 'acknowledged' | 'failed';
  source: 'websocket' | 'blockchain';
}

interface EventListeners {
  open: Array<() => void>;
  close: Array<() => void>;
  error: Array<(error: Event) => void>;
  message: Array<(data: any) => void>;
  robotStatus: Array<(data: { connected: boolean; room_id?: string }) => void>;
  controlAck: Array<(data: { status: string; command?: string }) => void>;
  robotFeedback: Array<(data: RobotFeedback) => void>;
  roomChanged: Array<(data: { new_room_id: string; room_name?: string; robot_connected: boolean }) => void>;
  heartbeat: Array<(data: { robot_name?: string; status: string }) => void>;
}

export class RobotWebSocketService {
  private socket: WebSocket | null = null;
  private clientId: string | null = null;
  private isRobotConnected: boolean = false;
  private currentRoomId: string | null = null;
  private currentRoomName: string | null = null;
  private eventListeners: EventListeners = {
    open: [],
    close: [],
    error: [],
    message: [],
    robotStatus: [],
    controlAck: [],
    robotFeedback: [],
    roomChanged: [],
    heartbeat: []
  };

  /**
   * Connect to the robot signalling server
   * @param url - WebSocket URL (e.g., ws://localhost:8000/ws)
   * @param roomId - Room ID to join (default: "default")
   * @returns Promise that resolves when connection is established
   */
  connect(url: string, roomId: string = "default"): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(url);
        
        // Set a connection timeout
        const connectionTimeout = setTimeout(() => {
          if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
            console.error('Robot WebSocket connection timed out');
            this.socket.close();
            reject(new Error('Robot connection timed out'));
          }
        }, 10000); // 10 second timeout

        this.socket.onopen = () => {
          console.log('Robot WebSocket connection established');
          clearTimeout(connectionTimeout);
          
          // Send initial message to identify as a consumer with room ID
          const helloMsg = JSON.stringify({ 
            role: 'consumer',
            room_id: roomId
          });
          this.socket!.send(helloMsg);
          
          this._triggerEvent('open');
        };

        this.socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          console.log('Robot WebSocket received message:', data);
          
          // Handle the first message (acknowledgement with client ID)
          if (data.type === 'ack' && data.role === 'consumer') {
            this.clientId = data.client_id;
            this.isRobotConnected = data.robot_connected;
            this.currentRoomId = data.room_id;
            this.currentRoomName = data.room_name || data.room_id;
            
            console.log(`Robot WebSocket connected as client: ${this.clientId}`);
            console.log(`Joined robot room: ${this.currentRoomName} (${this.currentRoomId})`);
            console.log(`Robot connected in room: ${this.isRobotConnected}`);
            
            // Request current status after a short delay
            setTimeout(() => {
              if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                try {
                  this.socket.send(JSON.stringify({
                    type: 'status_check',
                    client_id: this.clientId,
                    room_id: this.currentRoomId
                  }));
                  console.log('Sent robot status check request');
                } catch (error) {
                  console.error('Failed to send robot status check:', error);
                }
              }
            }, 300);
            
            resolve();
          } 
          // Handle robot status updates
          else if (data.type === 'robot_status') {
            if (!data.room_id || data.room_id === this.currentRoomId) {
              const previousStatus = this.isRobotConnected;
              this.isRobotConnected = data.connected;
              
              if (previousStatus !== this.isRobotConnected) {
                console.log(`Robot connection status changed: ${this.isRobotConnected}`);
                this._triggerEvent('robotStatus', data);
              }
            }
          } 
          // Handle control acknowledgments
          else if (data.type === 'control_ack') {
            this._triggerEvent('controlAck', data);
          }
          // Handle robot feedback data
          else if (data.type === 'robot_feedback') {
            if (!data.room_id || data.room_id === this.currentRoomId) {
              this._triggerEvent('robotFeedback', data);
            }
          }
          // Handle heartbeat messages from the robot
          else if (data.type === 'heartbeat') {
            if (!data.room_id || data.room_id === this.currentRoomId) {
              console.log(`Received robot heartbeat: ${data.status}`);
              this._triggerEvent('heartbeat', data);
            }
          }
          
          this._triggerEvent('message', data);
        };

        this.socket.onclose = () => {
          console.log('Robot WebSocket connection closed');
          this._triggerEvent('close');
        };

        this.socket.onerror = (error) => {
          console.error('Robot WebSocket error:', error);
          this._triggerEvent('error', error);
          reject(new Error('Robot WebSocket connection failed'));
        };
      } catch (error) {
        console.error('Failed to connect to Robot WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the robot signalling server
   */
  disconnect(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
    
    // Reset state
    this.socket = null;
    this.clientId = null;
    this.isRobotConnected = false;
    this.currentRoomId = null;
    this.currentRoomName = null;
  }

  /**
   * Send a control command to the robot in the current room
   * @param command - Command to send ('forward', 'backward', 'left', 'right', 'stop')
   * @param speed - Speed value (0.0 to 1.0)
   * @returns Whether the message was sent successfully
   */
  sendControlCommand(command: string, speed: number = 0.5): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error('Cannot send robot control command: WebSocket not connected');
      return false;
    }

    if (!this.isRobotConnected) {
      console.warn('Robot is not connected in this room, command may not be processed');
    }

    const controlMsg = {
      type: 'control',
      command: command,
      speed: command === 'stop' ? 0.0 : speed,
      room_id: this.currentRoomId,
      client_id: this.clientId,
      timestamp: Date.now()
    };

    try {
      this.socket.send(JSON.stringify(controlMsg));
      console.log(`Sent robot control command: ${command} at speed ${speed}`);
      return true;
    } catch (error) {
      console.error('Failed to send robot control command:', error);
      return false;
    }
  }

  /**
   * Get current room information
   */
  getCurrentRoom(): { roomId: string | null; roomName: string | null; isRobotConnected: boolean } {
    return {
      roomId: this.currentRoomId,
      roomName: this.currentRoomName,
      isRobotConnected: this.isRobotConnected
    };
  }

  /**
   * Check if connected to WebSocket server
   */
  get isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Check if robot is connected in current room
   */
  get robotConnected(): boolean {
    return this.isRobotConnected;
  }

  /**
   * Get current client ID
   */
  get getClientId(): string | null {
    return this.clientId;
  }

  /**
   * Add an event listener
   */
  addEventListener<T extends keyof EventListeners>(event: T, callback: EventListeners[T][0]): void {
    this.eventListeners[event].push(callback as any);
  }

  /**
   * Remove an event listener
   */
  removeEventListener<T extends keyof EventListeners>(event: T, callback: EventListeners[T][0]): void {
    this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback) as any;
  }

  /**
   * Trigger an event
   */
  private _triggerEvent<T extends keyof EventListeners>(event: T, data?: any): void {
    this.eventListeners[event].forEach(callback => {
      try {
        (callback as any)(data);
      } catch (error) {
        console.error(`Error in robot WebSocket event handler for ${event}:`, error);
      }
    });
  }
}

// Export singleton instance
export const robotWebSocketService = new RobotWebSocketService(); 