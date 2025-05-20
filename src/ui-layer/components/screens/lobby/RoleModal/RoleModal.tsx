import React from 'react';
import { RaceSession } from '../../../../../shared/types/race';
import { Button } from '../../../shared/Button';

interface RoleModalProps {
  isOpen: boolean;
  session: RaceSession | null;
  onClose: () => void;
  onSelectRole: (role: 'driver' | 'spectator') => void;
}

export const RoleModal: React.FC<RoleModalProps> = ({
  isOpen,
  session,
  onClose,
  onSelectRole,
}) => {
  if (!isOpen || !session) return null;

  const isRobotOnline = session.robotStatus.connected && 
    (Date.now() - session.robotStatus.lastHeartbeat) < 5000;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-[8px]"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative h-full flex items-center justify-center p-4">
        <div className={`
          relative w-full max-w-md overflow-hidden
          bg-gradient-to-b from-game-800/90 to-game-900/90
          rounded-2xl
          border border-white/10
          ${isRobotOnline ? 'shadow-lg shadow-blue-500/20' : 'shadow-lg shadow-red-500/20'}
        `}>
          {/* Track Preview */}
          <div className="relative h-56">
            <div className="absolute inset-0 bg-gradient-to-t from-game-900 via-game-900/80 to-transparent" />
            <img 
              src={session.thumbnailUrl}
              alt={session.trackName}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 p-8 space-y-2">
              <h2 className="text-2xl font-bold text-white">{session.trackName}</h2>
              <p className="text-base text-white/80">Select your role to join the race</p>
            </div>
          </div>

          {/* Status Section */}
          <div className="p-6 bg-game-800/50 space-y-6">
            {/* Top Row - Robot Status & Laps */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`
                  w-3 h-3 rounded-full
                  ${isRobotOnline 
                    ? 'bg-green-400 animate-pulse' 
                    : 'bg-red-400'}
                `} />
                <span className="text-white/90 font-medium">
                  Robot {isRobotOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/90 font-medium">
                  {session.lapCount} Laps
                </span>
              </div>
            </div>

            {/* Bottom Row - Battery & Latency */}
            <div className="grid grid-cols-2 gap-6">
              {/* Battery Indicator */}
              <div className="space-y-2">
                <div className="text-sm text-white/60 font-medium">Battery</div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-game-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500
                        ${session.robotStatus.batteryLevel > 50 ? 'bg-green-400' :
                          session.robotStatus.batteryLevel > 20 ? 'bg-yellow-400' : 'bg-red-400'}
                      `}
                      style={{ width: `${session.robotStatus.batteryLevel}%` }}
                    />
                  </div>
                  <span className="text-white/90 font-medium min-w-[3rem] text-right">
                    {Math.round(session.robotStatus.batteryLevel)}%
                  </span>
                </div>
              </div>

              {/* Latency Indicator */}
              <div className="space-y-2">
                <div className="text-sm text-white/60 font-medium">Latency</div>
                <div className="flex items-center justify-end gap-3">
                  <span className="text-white/90 font-medium">
                    {session.robotStatus.latency}ms
                  </span>
                  <div className={`
                    w-2 h-2 rounded-full
                    ${session.robotStatus.latency < 50 ? 'bg-green-400' :
                      session.robotStatus.latency < 100 ? 'bg-yellow-400' : 'bg-red-400'}
                  `} />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-6 space-y-3">
            <Button
              variant="primary"
              size="large"
              className={`
                w-full relative overflow-hidden group
                ${!isRobotOnline && 'opacity-50 cursor-not-allowed'}
              `}
              disabled={!isRobotOnline || session.players.driver !== undefined}
              onClick={() => onSelectRole('driver')}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v.01M12 8v.01M12 12v.01M12 16v.01M12 20v.01" />
                </svg>
                Drive
              </span>
            </Button>

            <Button
              variant="secondary"
              size="large"
              className="w-full"
              onClick={() => onSelectRole('spectator')}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Watch
              </span>
            </Button>

            <Button
              variant="secondary"
              size="large"
              className="w-full !bg-white/5 hover:!bg-white/10"
              onClick={onClose}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}; 