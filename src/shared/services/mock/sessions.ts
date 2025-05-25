import { RaceSession, RaceSessionStatus } from '../../types/race';

// Sample track data
const MOCK_TRACKS = [
  {
    id: 'circuit-alpha',
    name: 'Robo Delivery',
    thumbnail: '/tracks/circuit-alpha.jpg'
  },
  {
    id: 'desert-sprint',
    name: 'Crossy Robo',
    thumbnail: '/tracks/desert-sprint.jpg'
  },
  {
    id: 'city-rush',
    name: 'Robo Rumble',
    thumbnail: '/tracks/city-rush.jpg'
  }
];

// Generate a mock session for a track with static ID
const createMockSession = (trackIndex: number): RaceSession => {
  const track = MOCK_TRACKS[trackIndex];
  // Use static session ID based on track ID for consistent channel names
  // This allows hosts and viewers to join the same Agora channel
  const sessionId = `${track.id}-session-001`;
  
  return {
    id: sessionId,
    trackId: track.id,
    trackName: track.name,
    thumbnailUrl: track.thumbnail,
    lapCount: Math.floor(Math.random() * 4) + 3, // 3-6 laps
    status: 'waiting' as RaceSessionStatus,
    robotStatus: {
      connected: Math.random() > 0.2, // 80% chance of being connected
      batteryLevel: Math.floor(Math.random() * 30) + 70, // 70-100%
      lastHeartbeat: Date.now(),
      latency: Math.floor(Math.random() * 20) + 30 // 30-50ms
    },
    players: {
      spectators: []
    }
  };
};

// Create initial set of sessions - these will persist for streaming consistency
let mockSessions: RaceSession[] = Array(3)
  .fill(null)
  .map((_, index) => createMockSession(index));

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const MockSessionService = {
  // Get all active sessions
  getSessions: async (): Promise<RaceSession[]> => {
    await delay(300); // Simulate network delay
    return mockSessions;
  },

  // Update session status
  updateSession: async (sessionId: string, updates: Partial<RaceSession>): Promise<RaceSession> => {
    await delay(200);
    mockSessions = mockSessions.map(session => 
      session.id === sessionId 
        ? { ...session, ...updates }
        : session
    );
    return mockSessions.find(s => s.id === sessionId)!;
  },

  // Simulate real-time updates (called by polling)
  simulateUpdates: () => {
    mockSessions = mockSessions.map(session => {
      // Simulate random disconnections (5% chance if connected, 10% chance to reconnect if disconnected)
      const shouldChangeConnection = Math.random() < (session.robotStatus.connected ? 0.05 : 0.10);
      const nextConnectionState = shouldChangeConnection ? !session.robotStatus.connected : session.robotStatus.connected;

      return {
        ...session,
        robotStatus: {
          ...session.robotStatus,
          connected: nextConnectionState,
          // Only update heartbeat if connected
          lastHeartbeat: nextConnectionState ? Date.now() : session.robotStatus.lastHeartbeat,
          // Latency varies more when connection is unstable
          latency: nextConnectionState 
            ? Math.floor(Math.random() * 20) + 30 // 30-50ms when connected
            : Math.floor(Math.random() * 100) + 100, // 100-200ms when having issues
          // Battery drains faster when connected
          batteryLevel: Math.max(0, session.robotStatus.batteryLevel - (nextConnectionState ? 0.1 : 0.02))
        }
      };
    });
  }
}; 