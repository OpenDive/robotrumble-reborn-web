import React from 'react';
import { RaceSession } from '../../../../../shared/types/race';
import { RaceCard } from './RaceCard';

interface RaceCardGridProps {
  sessions: RaceSession[];
  onSelectSession: (sessionId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export const RaceCardGrid: React.FC<RaceCardGridProps> = ({
  sessions,
  onSelectSession,
  isLoading = false,
  className
}) => {
  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 ${className || ''}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-game-800/50 rounded-xl overflow-hidden border border-white/5">
              <div className="aspect-video bg-game-700/50" />
              <div className="p-6 space-y-4">
                <div className="h-6 bg-game-700/50 rounded-full w-3/4" />
                <div className="flex gap-4">
                  <div className="h-4 bg-game-700/50 rounded-full w-20" />
                  <div className="h-4 bg-game-700/50 rounded-full w-20" />
                  <div className="h-4 bg-game-700/50 rounded-full w-20" />
                </div>
                <div className="h-4 bg-game-700/50 rounded-full w-full mt-2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-white/60">
        <div className="bg-game-800/40 backdrop-blur-sm rounded-xl p-8 border border-white/5">
          <p className="text-xl font-medium text-white/80">No active races found</p>
          <p className="text-sm mt-2 text-white/60">Check back later or create a new race</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-1 ${className || ''}`}>
      {sessions.map((session) => (
        <div key={session.id} className="w-full">
          <RaceCard
            session={session}
            onSelect={onSelectSession}
          />
        </div>
      ))}
    </div>
  );
}; 