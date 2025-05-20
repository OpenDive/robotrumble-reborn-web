import React, { useEffect, useRef } from 'react';
import { engine } from '../../../engine-layer';
import { isDebugEnabled } from '../../../shared/config/env';

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
    const initEngine = async () => {
      try {
        await engine.initialize(containerRef.current!);
        onEngineReady?.();
      } catch (error) {
        console.error('Failed to initialize engine:', error);
      }
    };

    initEngine();

    // Cleanup when component unmounts
    return () => {
      engine.cleanup();
    };
  }, [onEngineReady]);

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      {/* Engine Container */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full bg-blue-500"
        style={{ minHeight: '100vh' }}
      />

      {/* HUD Layer */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Debug Tools Layer - Enable pointer events */}
        <div className="pointer-events-auto">
          {isDebugEnabled && children}
        </div>
        {/* Game HUD Layer - Keep pointer events disabled */}
        <div className="relative w-full h-full">
          {!isDebugEnabled && children}
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
