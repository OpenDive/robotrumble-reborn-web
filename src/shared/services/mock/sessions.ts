import { RaceSession, RaceSessionStatus } from '../../types/race';

// Sample track data
const MOCK_TRACKS = [
  {
    id: 'circuit-alpha',
    name: 'Robo Delivery',
    thumbnail: '/assets/suibotics1.png'
  },
  {
    id: 'desert-sprint',
    name: 'Crossy Robo',
    thumbnail: '/assets/suibotics2.png'
  },
  {
    id: 'city-rush',
    name: 'Robo Rumble',
    thumbnail: '/assets/suibotics3.png'
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
      connected: true, // Always online for demo
      batteryLevel: Math.floor(Math.random() * 30) + 70, // 70-100%
      lastHeartbeat: Date.now(), // Always start with current timestamp
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
    // Always refresh heartbeats when getting sessions to ensure they appear online
    mockSessions = mockSessions.map(session => ({
      ...session,
      robotStatus: {
        ...session.robotStatus,
        connected: true,
        lastHeartbeat: Date.now() // Always fresh heartbeat
      }
    }));
    return mockSessions;
  },

  // Update session status
  updateSession: async (sessionId: string, updates: Partial<RaceSession>): Promise<RaceSession> => {
    await delay(200);
    mockSessions = mockSessions.map(session => 
      session.id === sessionId 
        ? { 
            ...session, 
            ...updates,
            robotStatus: {
              ...session.robotStatus,
              ...updates.robotStatus,
              connected: true, // Always keep connected
              lastHeartbeat: Date.now() // Always fresh heartbeat
            }
          }
        : session
    );
    return mockSessions.find(s => s.id === sessionId)!;
  },

  // Simulate real-time updates (called by polling)
  simulateUpdates: () => {
    mockSessions = mockSessions.map(session => {
      // Keep all robots always online for demo
      return {
        ...session,
        robotStatus: {
          ...session.robotStatus,
          connected: true, // Always keep online
          lastHeartbeat: Date.now(), // Always fresh heartbeat - this is key!
          latency: Math.floor(Math.random() * 20) + 30, // 30-50ms stable connection
          // Battery drains very slowly
          batteryLevel: Math.max(70, session.robotStatus.batteryLevel - 0.05)
        }
      };
    });
  }
}; 