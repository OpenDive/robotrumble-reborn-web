import React from 'react';
import { GameLayout } from '../layout/GameLayout';
import { engine } from '../../../engine-layer';
import { VideoSourceDebug } from '../debug/VideoSourceDebug';
import { ARDebugPanel } from '../debug/ARDebugPanel';
import { isDebugEnabled } from '../../../shared/config/env';
import { DebugCategoriesPanel } from '../debug/DebugCategoriesPanel';

interface RaceScreenProps {
  onBack: () => void;
}

export const RaceScreen: React.FC<RaceScreenProps> = ({ onBack }) => {
  const handleEngineReady = () => {
    console.log('Engine ready, starting race...');
    engine.startRace();
  };

  return (
    <GameLayout onEngineReady={handleEngineReady}>
      {/* HUD Components */}
      <div className="absolute top-4 left-4 text-white space-y-2">
        <button
          onClick={onBack}
          className="bg-black/50 hover:bg-black/70 p-2 rounded flex items-center gap-2"
        >
          <span>←</span> Back
        </button>
        <div className="bg-black/50 p-2 rounded">
          Speed: 0 km/h
        </div>
      </div>
      <div className="absolute top-4 right-4 text-white">
        <div className="bg-black/50 p-2 rounded">
          Lap: 1/3
        </div>
      </div>
      {/* Debug Tools */}
      {isDebugEnabled && (
        <>
          <VideoSourceDebug />
          <ARDebugPanel />
          <DebugCategoriesPanel />
        </>
      )}
    </GameLayout>
  );
};
