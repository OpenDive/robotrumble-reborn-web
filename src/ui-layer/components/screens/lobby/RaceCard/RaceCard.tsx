import React from 'react';
import { RaceSession } from '../../../../../shared/types/race';

interface RaceCardProps {
  session: RaceSession;
  onSelect: (sessionId: string) => void;
}

export const RaceCard: React.FC<RaceCardProps> = ({ session, onSelect }) => {
  const isRobotOnline = session.robotStatus.connected && 
    (Date.now() - session.robotStatus.lastHeartbeat) < 5000;

  return (
    <div 
      className="bg-game-800/30 rounded-lg overflow-hidden cursor-pointer hover:bg-game-800/40 transition-colors"
      onClick={() => onSelect(session.id)}
    >
      {/* Track Image and Online Status */}
      <div className="relative">
        <img 
          src={session.thumbnailUrl} 
          alt={session.trackName}
          className="w-full aspect-video object-cover"
        />
        <div className="absolute top-4 right-4">
          <span className="px-4 py-1.5 rounded-md text-sm bg-black/50 text-white/90 backdrop-blur-sm">
            {isRobotOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Track Info */}
      <div className="p-4 space-y-6">
        {/* Title Row */}
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-medium text-white">{session.trackName}</h3>
          <span className="text-blue-400">{session.lapCount} Laps</span>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-6 text-sm text-white/80">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
            <span>{session.robotStatus.latency}ms</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
            <span>{Math.round(session.robotStatus.batteryLevel)}%</span>
          </div>
          <div>
            <span>{session.players.spectators.length} Spectating</span>
          </div>
        </div>

        {/* Status Footer */}
        <div className="flex justify-between items-center pt-4 border-t border-white/10">
          <span className="text-white/60">
            {session.players.driver ? `Driver: ${session.players.driver.name}` : 'No Driver'}
          </span>
          <span className="text-white/40">
            {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
          </span>
        </div>
      </div>
    </div>
  );
}; 