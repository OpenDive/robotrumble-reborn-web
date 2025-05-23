import React from 'react';
import { GameState, KeyState } from '../../../shared/types/GameTypes';

interface GameHUDProps {
  gameState: GameState;
  keysState: KeyState;
}

export const GameHUD: React.FC<GameHUDProps> = ({ gameState, keysState }) => {
  return (
    <>
      {/* Collision warning */}
      <div style={{ 
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: gameState.isColliding ? 'red' : 'white',
        padding: '10px',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: '5px',
        fontFamily: 'monospace'
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
        borderRadius: '5px'
      }}>
        <div>Keys: {JSON.stringify(keysState)}</div>
        <div>Position: X:{gameState.position.x.toFixed(2)} Y:{gameState.position.y.toFixed(2)} Z:{gameState.position.z.toFixed(2)}</div>
        <div>Rotation: {gameState.rotation.toFixed(2)}</div>
      </div>
    </>
  );
}; 