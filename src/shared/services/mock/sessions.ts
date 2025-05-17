import { RaceSession, RaceSessionStatus } from '../../types/race';

// Sample track data
const MOCK_TRACKS = [
  {
    id: 'circuit-alpha',
    name: 'Circuit Alpha',
    thumbnail: '/tracks/circuit-alpha.jpg'
  },
  {
    id: 'desert-sprint',
    name: 'Desert Sprint',
    thumbnail: '/tracks/desert-sprint.jpg'
  },
  {
    id: 'city-rush',
    name: 'City Rush',
    thumbnail: '/tracks/city-rush.jpg'
  }
];

// Generate a mock session for a track
const createMockSession = (trackIndex: number): RaceSession => {
  const track = MOCK_TRACKS[trackIndex];
  return {
    id: `${track.id}-${Date.now()}`,
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

// Create initial set of sessions
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
    mockSessions = mockSessions.map(session => ({
      ...session,
      robotStatus: {
        ...session.robotStatus,
        lastHeartbeat: Date.now(),
        latency: Math.floor(Math.random() * 20) + 30,
        batteryLevel: Math.max(0, session.robotStatus.batteryLevel - 0.1)
      }
    }));
  }
}; 