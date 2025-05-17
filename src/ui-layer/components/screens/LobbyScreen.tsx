import React, { useEffect, useState } from 'react';
import { RaceSession } from '../../../shared/types/race';
import { MockSessionService } from '../../../shared/services/mock/sessions';
import { RaceCardGrid } from './lobby/RaceCard/RaceCardGrid';
import { RoleModal } from './lobby/RoleModal/RoleModal';
import { Header } from '../layout/Header';
import { PageContainer } from '../layout/PageContainer';

interface LobbyScreenProps {
  onStartRace: () => void;
  onBack: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ onStartRace, onBack }) => {
  const [sessions, setSessions] = useState<RaceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<RaceSession | null>(null);
  const [isRoleModalOpen, setRoleModalOpen] = useState(false);

  // Fetch sessions initially and poll for updates
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await MockSessionService.getSessions();
        setSessions(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchSessions();

    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      MockSessionService.simulateUpdates();
      fetchSessions();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSessionSelect = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setSelectedSession(session);
      setRoleModalOpen(true);
    }
  };

  const handleRoleSelect = async (role: 'driver' | 'spectator') => {
    if (!selectedSession) return;

    try {
      // Update session with new role
      await MockSessionService.updateSession(selectedSession.id, {
        status: role === 'driver' ? 'ready' : 'waiting',
        players: {
          ...selectedSession.players,
          driver: role === 'driver' ? { id: 'player1', name: 'You', role: 'driver' } : undefined,
          spectators: role === 'spectator' 
            ? [...selectedSession.players.spectators, { id: 'player1', name: 'You', role: 'spectator' }]
            : selectedSession.players.spectators
        }
      });

      // Close modal and start race if driver
      setRoleModalOpen(false);
      if (role === 'driver') {
        onStartRace();
      }
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-game-900 to-game-800 flex flex-col">
      {/* Header */}
      <Header
        title="Race Lobby"
        subtitle="Select a race to join"
        onBack={onBack}
      />

      {/* Main Content */}
      <div className="flex-1">
        <PageContainer className="py-6">
          <RaceCardGrid
            sessions={sessions}
            onSelectSession={handleSessionSelect}
            isLoading={isLoading}
          />
        </PageContainer>
      </div>

      {/* Footer */}
      <div className="border-t border-white/5">
        <PageContainer className="py-4">
          <div className="flex justify-between items-center text-sm text-white/40">
            <div>
              RobotRumble v0.1.0
            </div>
            <div className="flex items-center gap-4">
              <span>Ping: 32ms</span>
              <span className="text-white/20">•</span>
              <span>Region: US West</span>
            </div>
          </div>
        </PageContainer>
      </div>

      {/* Role Selection Modal */}
      <RoleModal
        isOpen={isRoleModalOpen}
        session={selectedSession}
        onClose={() => setRoleModalOpen(false)}
        onSelectRole={handleRoleSelect}
      />
    </div>
  );
};
