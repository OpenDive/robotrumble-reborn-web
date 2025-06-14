import React, { useEffect, useState } from 'react';
import { RaceSession } from '../../../shared/types/race';
import { MockSessionService } from '../../../shared/services/mock/sessions';
import { RaceCardGrid } from './lobby/RaceCard/RaceCardGrid';
import { RoleModal } from './lobby/RoleModal/RoleModal';
import { Header } from '../layout/Header';
import { PageContainer } from '../layout/PageContainer';
import { SuiWalletConnect } from '../shared/SuiWalletConnect';

interface LobbyScreenProps {
  onStartRace: () => void;
  onBack: () => void;
  onTestGame?: () => void;
  onStartARStream?: (session: RaceSession) => void;
  onJoinARStream?: (session: RaceSession) => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({ 
  onStartRace, 
  onBack, 
  onTestGame,
  onStartARStream,
  onJoinARStream
}) => {
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

      // Close modal
      setRoleModalOpen(false);
      
      // Navigate to appropriate AR streaming screen
      if (role === 'driver') {
        if (onStartARStream) {
          onStartARStream(selectedSession);
        } else {
          // Fallback to original behavior
          onStartRace();
        }
      } else {
        if (onJoinARStream) {
          onJoinARStream(selectedSession);
        } else {
          // For now, just log the action since there's no fallback for spectators
          console.log('Joining as spectator for session:', selectedSession.id);
        }
      }
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  };

  return (
    <div className="w-full h-screen bg-[#0B0B1A] relative overflow-hidden flex flex-col">
      {/* Background grid effect with racing theme */}
      <div className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2">
        <div 
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage: `
              linear-gradient(to right, #4C9EFF 1px, transparent 1px),
              linear-gradient(to bottom, #4C9EFF 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            transform: 'perspective(1000px) rotateX(60deg)',
            transformOrigin: 'center center',
          }}
        />
      </div>
      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#0B0B1A]/80 to-[#0B0B1A]"/>
      
      {/* Wallet address button - positioned at top right */}
      <div className="absolute top-6 right-6 z-50">
        <SuiWalletConnect />
      </div>
      
      {/* Header */}
      <Header
        title="Race Lobby"
        subtitle="Select a race to join"
        className="relative z-10 bg-gradient-to-r from-game-900/50 via-game-800/50 to-game-900/50 backdrop-blur-sm border-b border-white/5"
      />

      {/* Main Content */}
      <div className="flex-1 relative z-10">
        <PageContainer className="py-6">
          {/* Racing theme decorative elements */}
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-neon-blue/10 to-transparent pointer-events-none" />
          <div className="relative">
            <RaceCardGrid
              sessions={sessions}
              onSelectSession={handleSessionSelect}
              isLoading={isLoading}
              className="animate-float"
            />
          </div>
        </PageContainer>
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-white/10 bg-gradient-to-b from-transparent to-game-900/50 backdrop-blur-sm">
        <PageContainer className="py-4">
          {/* Racing theme decorative elements */}
          <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#4C9EFF]/5 to-transparent pointer-events-none" />
          <div className="flex justify-between items-center text-sm text-white/40">
            <div>
              RobotRumble v0.1.0
            </div>
            <div className="flex items-center gap-4">
              <span>Ping: 32ms</span>
              <span className="text-white/20">•</span>
              <span>Region: US West</span>
              {onTestGame && (
                <>
                  <span className="text-white/20">•</span>
                  <button
                    onClick={onTestGame}
                    className="text-neon-blue hover:text-white transition-colors"
                  >
                    Test Game
                  </button>
                </>
              )}
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
