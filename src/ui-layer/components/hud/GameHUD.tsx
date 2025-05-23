import React from 'react';
import { GameState, KeyState } from '../../../shared/types/GameTypes';

interface GameHUDProps {
  gameState: GameState;
  keysState: KeyState;
  arMode: boolean;
  onToggleAR: () => Promise<void>;
  webcamError: string | null;
  debugHideCanvas: boolean;
  onToggleDebugCanvas: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({ 
  gameState, 
  keysState, 
  arMode, 
  onToggleAR, 
  webcamError,
  debugHideCanvas,
  onToggleDebugCanvas
}) => {
  return (
    <>
      {/* AR Mode Toggle Button */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 1000,
        pointerEvents: 'auto'
      }}>
        <button
          onClick={onToggleAR}
          style={{
            padding: '10px 20px',
            backgroundColor: arMode ? '#ff4444' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            zIndex: 1001,
            pointerEvents: 'auto'
          }}
        >
          {arMode ? 'Exit AR' : 'Enter AR'}
        </button>
        
        {/* Webcam Error Display */}
        {webcamError && (
          <div style={{
            padding: '10px',
            backgroundColor: 'rgba(255, 0, 0, 0.8)',
            color: 'white',
            borderRadius: '5px',
            fontSize: '12px',
            maxWidth: '200px',
            zIndex: 1001
          }}>
            {webcamError}
          </div>
        )}
        
        {/* AR Mode Indicator */}
        {arMode && (
          <div style={{
            padding: '5px 10px',
            backgroundColor: 'rgba(76, 175, 80, 0.8)',
            color: 'white',
            borderRadius: '5px',
            fontSize: '12px',
            textAlign: 'center',
            zIndex: 1001
          }}>
            AR Mode Active
          </div>
        )}
        
        {/* Debug Canvas Toggle (only show in AR mode) */}
        {arMode && (
          <button
            onClick={onToggleDebugCanvas}
            style={{
              padding: '5px 10px',
              backgroundColor: debugHideCanvas ? '#ff9800' : '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '12px',
              zIndex: 1001,
              pointerEvents: 'auto'
            }}
          >
            {debugHideCanvas ? 'Show Canvas' : 'Hide Canvas'}
          </button>
        )}
      </div>
      
      {/* Collision warning */}
      <div style={{ 
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: gameState.isColliding ? 'red' : 'white',
        padding: '10px',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: '5px',
        fontFamily: 'monospace',
        zIndex: 1000
      }}>
        {gameState.isColliding ? 'COLLISION!' : 'No collision'}
      </div>
      
      {/* Debug overlay */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        padding: '10px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: 'white',
        fontFamily: 'monospace',
        borderRadius: '5px',
        zIndex: 1000
      }}>
        <div>Mode: {arMode ? 'AR' : 'Normal'}</div>
        <div>Keys: {JSON.stringify(keysState)}</div>
        <div>Position: X:{gameState.position.x.toFixed(2)} Y:{gameState.position.y.toFixed(2)} Z:{gameState.position.z.toFixed(2)}</div>
        <div>Rotation: {gameState.rotation.toFixed(2)}</div>
      </div>
    </>
  );
}; 