import React from 'react';
import { GameLayout } from '../layout/GameLayout';
import { engine } from '../../../engine-layer';

export const RaceScreen: React.FC = () => {
  const handleEngineReady = () => {
    console.log('Engine ready, starting race...');
    engine.startRace();
  };

  return (
    <GameLayout onEngineReady={handleEngineReady}>
      {/* HUD Components */}
      <div className="absolute top-4 left-4 text-white">
        <div className="bg-black/50 p-2 rounded">
          Speed: 0 km/h
        </div>
      </div>
      <div className="absolute top-4 right-4 text-white">
        <div className="bg-black/50 p-2 rounded">
          Lap: 1/3
        </div>
      </div>
      <div className="absolute bottom-4 left-4 text-white">
        <div className="bg-black/50 p-2 rounded">
          Connection: Good
        </div>
      </div>
    </GameLayout>
  );
};
