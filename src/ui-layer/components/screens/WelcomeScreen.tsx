import React from 'react';
import { Button } from '../shared/Button';

interface WelcomeScreenProps {
  onQuickPlay: () => void;
  onCustomGame: () => void;
  onSettings: () => void;
  onTutorial: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onQuickPlay,
  onCustomGame,
  onSettings,
  onTutorial,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-game-900 to-game-800 text-white flex items-center justify-center">
      <div className="w-full max-w-lg px-6 py-8">
        {/* Logo and Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
            RobotRumble
          </h1>
          <p className="mt-4 text-lg text-white/80">
            Browser-based Mixed Reality Racing
          </p>
        </div>

        {/* Main Menu */}
        <div className="space-y-4">
          <Button
            variant="primary"
            size="large"
            className="w-full"
            onClick={onQuickPlay}
          >
            Quick Play
          </Button>

          <Button
            variant="secondary"
            size="large"
            className="w-full"
            onClick={onCustomGame}
          >
            Custom Game
          </Button>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <Button
              variant="secondary"
              size="medium"
              className="w-full"
              onClick={onSettings}
            >
              Settings
            </Button>

            <Button
              variant="secondary"
              size="medium"
              className="w-full"
              onClick={onTutorial}
            >
              Tutorial
            </Button>
          </div>
        </div>

        {/* Version Info */}
        <div className="mt-12 text-center text-sm text-white/60">
          <p>Version 0.1.0-alpha</p>
        </div>
      </div>
    </div>
  );
};
