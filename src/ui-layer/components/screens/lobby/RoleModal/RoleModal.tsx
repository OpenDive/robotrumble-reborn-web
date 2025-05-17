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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-game-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">{session.trackName}</h2>
          <p className="text-white/60 mt-1">Select your role to join the race</p>
        </div>

        {/* Status Indicators */}
        <div className="px-6 py-4 bg-game-700/50 grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isRobotOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-white/80">
              {isRobotOnline ? 'Robot Online' : 'Robot Offline'}
            </span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <span className="text-white/80">{session.robotStatus.latency}ms</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              session.robotStatus.batteryLevel > 50 ? 'bg-green-500' : 
              session.robotStatus.batteryLevel > 20 ? 'bg-yellow-500' : 
              'bg-red-500'
            }`} />
            <span className="text-white/80">
              Battery: {Math.round(session.robotStatus.batteryLevel)}%
            </span>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <span className="text-white/80">
              {session.players.spectators.length} Spectating
            </span>
          </div>
        </div>

        {/* Role Selection */}
        <div className="p-6 space-y-4">
          <Button
            variant="primary"
            size="large"
            className="w-full"
            disabled={!isRobotOnline || session.players.driver !== undefined}
            onClick={() => onSelectRole('driver')}
          >
            Drive
          </Button>
          <Button
            variant="secondary"
            size="large"
            className="w-full"
            onClick={() => onSelectRole('spectator')}
          >
            Watch
          </Button>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2">
          <Button
            variant="secondary"
            size="small"
            className="w-full"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}; 