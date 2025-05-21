import React from 'react';
import { Button } from '../shared/Button';
import './WelcomeScreen.css';

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
    <div className="welcome-screen min-h-screen text-white flex items-center justify-center relative overflow-hidden">
      {/* Racing checkered pattern overlay */}
      <div className="checkered-overlay absolute inset-0 opacity-10" />
      
      {/* Speed lines animation */}
      <div className="speed-lines absolute inset-0" />
      
      {/* Main content */}
      <div className="welcome-content w-full max-w-lg px-6 py-8 relative z-10">
        {/* Logo and Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-300 bg-clip-text text-transparent drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
            RobotRumble
          </h1>
          <p className="mt-4 text-lg text-yellow-200 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
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
