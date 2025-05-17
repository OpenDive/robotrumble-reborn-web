export interface RaceSession {
  id: string;
  trackId: string;
  trackName: string;
  thumbnailUrl: string;
  lapCount: number;
  status: RaceSessionStatus;
  robotStatus: RobotStatus;
  players: {
    driver?: Player;
    spectators: Player[];
  };
}

export interface RobotStatus {
  connected: boolean;
  batteryLevel: number;
  lastHeartbeat: number;
  latency: number;
}

export interface Player {
  id: string;
  name: string;
  role: 'driver' | 'spectator';
}

export type RaceSessionStatus = 
  | 'waiting'    // Waiting for driver
  | 'ready'      // Has driver, ready to start
  | 'racing'     // Race in progress
  | 'finished';  // Race completed 