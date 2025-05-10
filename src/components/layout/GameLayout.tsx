import React, { useEffect, useRef } from 'react';
import { Engine } from '../../engine/core/Engine';

interface GameLayoutProps {
  children: React.ReactNode;
  engineOptions?: {
    showStats?: boolean;
    debugMode?: boolean;
  };
  onEngineReady?: (engine: Engine) => void;
}

export const GameLayout: React.FC<GameLayoutProps> = ({
  children,
  engineOptions = {},
  onEngineReady,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    if (!canvasRef.current || engineRef.current) return;

    const engine = new Engine({
      canvas: canvasRef.current,
      ...engineOptions,
    });

    engineRef.current = engine;
    onEngineReady?.(engine);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [engineOptions, onEngineReady]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-game-900">
      {/* AR Canvas */}
      <canvas
        ref={canvasRef}
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
