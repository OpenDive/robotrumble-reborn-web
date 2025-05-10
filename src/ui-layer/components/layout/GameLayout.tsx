import React, { useEffect, useRef } from 'react';
import { engine } from '../../../engine-layer';

interface GameLayoutProps {
  children: React.ReactNode;
  engineOptions?: {
    showStats?: boolean;
    debugMode?: boolean;
  };
  onEngineReady?: () => void;
}

export const GameLayout: React.FC<GameLayoutProps> = ({
  children,
  engineOptions = {},
  onEngineReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize engine with container
    engine.initialize(containerRef.current);
    onEngineReady?.();

    // No cleanup needed as engine is a singleton
  }, [onEngineReady]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-game-900">
      {/* Engine Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* HUD Layer */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="relative w-full h-full">
          {children}
        </div>
      </div>

      {/* Debug Stats (if enabled) */}
      {engineOptions.showStats && (
        <div className="absolute top-0 left-0 z-50">
          {/* Stats will be injected here by Engine */}
        </div>
      )}

      {/* Touch Controls Container */}
      <div className="absolute bottom-0 left-0 right-0 h-32 md:h-40 pointer-events-auto">
        {/* Touch controls will be injected here */}
      </div>
    </div>
  );
};
