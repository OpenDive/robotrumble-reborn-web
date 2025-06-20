import React from 'react';
import { RaceSession } from '../../../../../shared/types/race';

interface RaceCardProps {
  session: RaceSession;
  onSelect: (sessionId: string) => void;
}

export const RaceCard: React.FC<RaceCardProps> = ({ session, onSelect }) => {
  const isRobotOnline = session.robotStatus.connected && 
    (Date.now() - session.robotStatus.lastHeartbeat) < 5000;
  
  // Check if this is the Robo Delivery track (locked)
  const isLocked = session.trackName === 'Robo Delivery';

  const handleClick = () => {
    if (!isLocked) {
      onSelect(session.id);
    }
  };

  return (
    <div 
      className={`
        group relative overflow-hidden rounded-3xl
        bg-gradient-to-b from-game-800/80 to-game-800/40
        backdrop-blur-sm
        border-2 border-white/10
        transition-all duration-300 ease-out
        ${isLocked 
          ? 'opacity-60 cursor-not-allowed' 
          : `hover:transform hover:scale-[1.02] hover:-rotate-1
             hover:border-[#4C9EFF]/40
             cursor-pointer
             ${isRobotOnline 
               ? 'shadow-lg shadow-[#4C9EFF]/20 hover:shadow-[#4C9EFF]/30' 
               : 'shadow-lg shadow-red-500/20 hover:shadow-red-500/30'}`}
      `}
      onClick={handleClick}
    >
      {/* Glow effect - only for unlocked cards */}
      {!isLocked && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute inset-0 bg-gradient-radial from-[#4C9EFF]/20 to-transparent blur-xl" />
        </div>
      )}
      
      {/* Lock overlay for Robo Delivery */}
      {isLocked && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="text-center">
            <img 
              src="/assets/transparent-lock.png" 
              alt="Locked" 
              className="w-16 h-16 mx-auto mb-4 opacity-80"
            />
            <p className="text-white font-semibold text-lg mb-2">Not Available</p>
            <p className="text-white/70 text-sm px-4">This track requires permission for drone control outdoors</p>
          </div>
        </div>
      )}
      
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
            px-4 py-1.5 rounded-full text-sm font-medium
            transition-all duration-300
            ${isRobotOnline 
              ? 'bg-[#4C9EFF]/20 text-[#4C9EFF] border border-[#4C9EFF]/30 group-hover:bg-[#4C9EFF]/30 group-hover:border-[#4C9EFF]/40' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30 group-hover:bg-red-500/30 group-hover:border-red-500/40'}
            backdrop-blur-sm
            shadow-lg ${isRobotOnline ? 'shadow-[#4C9EFF]/20' : 'shadow-red-500/20'}
          `}>
            {isRobotOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Middle Layer - Track Info */}
      <div className="relative p-6 pb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-2xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent transition-all duration-300 ${!isLocked ? 'group-hover:from-[#4C9EFF] group-hover:to-[#4C9EFF]/80' : ''}`}>
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