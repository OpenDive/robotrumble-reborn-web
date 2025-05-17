import React from 'react';
import { RaceSession } from '../../../../../shared/types/race';
import { RaceCard } from './RaceCard';

interface RaceCardGridProps {
  sessions: RaceSession[];
  onSelectSession: (sessionId: string) => void;
  isLoading?: boolean;
}

export const RaceCardGrid: React.FC<RaceCardGridProps> = ({
  sessions,
  onSelectSession,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-game-800/50 rounded-lg overflow-hidden">
              <div className="aspect-video bg-game-700/50" />
              <div className="p-4 space-y-4">
                <div className="h-6 bg-game-700/50 rounded w-3/4" />
                <div className="flex gap-4">
                  <div className="h-4 bg-game-700/50 rounded w-20" />
                  <div className="h-4 bg-game-700/50 rounded w-20" />
                  <div className="h-4 bg-game-700/50 rounded w-20" />
                </div>
                <div className="h-4 bg-game-700/50 rounded w-full mt-2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-white/60">
        <p className="text-lg">No active races found</p>
        <p className="text-sm mt-2">Check back later or create a new race</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {sessions.map((session) => (
        <div key={session.id} className="max-w-[480px] w-full mx-auto">
          <RaceCard
            session={session}
            onSelect={onSelectSession}
          />
        </div>
      ))}
    </div>
  );
}; 