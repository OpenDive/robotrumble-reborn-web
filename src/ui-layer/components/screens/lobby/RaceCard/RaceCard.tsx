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
      className={`
        group relative overflow-hidden rounded-xl
        bg-gradient-to-b from-game-800/80 to-game-800/40
        backdrop-blur-sm
        border border-white/5 hover:border-white/10
        transition-all duration-300 ease-out
        hover:transform hover:scale-[1.02] hover:shadow-2xl
        ${isRobotOnline ? 'shadow-lg shadow-blue-500/5' : 'shadow-lg shadow-red-500/5'}
      `}
      onClick={() => onSelect(session.id)}
    >
      {/* Top Layer - Track Image */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-t from-game-900/80 to-transparent z-10" />
        <img 
          src={session.thumbnailUrl} 
          alt={session.trackName}
          className="w-full aspect-video object-cover"
        />
        <div className="absolute top-4 right-4 z-20">
          <span className={`
            px-4 py-1.5 rounded-full text-sm
            ${isRobotOnline 
              ? 'bg-blue-500/20 text-blue-200 border border-blue-500/20' 
              : 'bg-red-500/20 text-red-200 border border-red-500/20'}
            backdrop-blur-sm
          `}>
            {isRobotOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Middle Layer - Track Info */}
      <div className="relative p-6 pb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-medium text-white group-hover:text-blue-200 transition-colors">
            {session.trackName}
          </h3>
          <span className="text-blue-400 font-medium">{session.lapCount} Laps</span>
        </div>

        {/* Stats Row with enhanced visualization */}
        <div className="flex items-center gap-6 text-sm text-white/80">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full bg-blue-400 ${isRobotOnline ? 'animate-pulse' : ''}`} />
            <span>{session.robotStatus.latency}ms</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`
              w-2 h-2 rounded-full
              ${session.robotStatus.batteryLevel > 50 ? 'bg-green-400' :
                session.robotStatus.batteryLevel > 20 ? 'bg-yellow-400' : 'bg-red-400'}
            `} />
            <span>{Math.round(session.robotStatus.batteryLevel)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span>{session.players.spectators.length} Spectating</span>
          </div>
        </div>
      </div>

      {/* Bottom Layer - Status Footer */}
      <div className="px-6 py-4 border-t border-white/5 bg-game-900/40">
        <div className="flex justify-between items-center">
          <span className="text-white/60">
            {session.players.driver ? `Driver: ${session.players.driver.name}` : 'No Driver'}
          </span>
          <span className={`
            text-sm px-3 py-1 rounded-full
            ${session.status === 'waiting' ? 'bg-blue-500/10 text-blue-200' :
              session.status === 'ready' ? 'bg-green-500/10 text-green-200' :
              'bg-white/10 text-white/60'}
          `}>
            {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
          </span>
        </div>
      </div>
    </div>
  );
}; 