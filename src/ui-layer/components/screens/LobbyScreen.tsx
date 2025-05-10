import type { FC } from 'react';
import { Button } from '../shared/Button';

interface LobbyScreenProps {
  onStartRace: () => void;
  onBack: () => void;
}

export const LobbyScreen: FC<LobbyScreenProps> = ({ onStartRace, onBack }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-8">Race Lobby</h1>
      
      <div className="w-full max-w-2xl bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-2xl font-semibold mb-4">Race Settings</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span>Track:</span>
            <select className="bg-gray-700 rounded px-3 py-2">
              <option>Circuit Alpha</option>
              <option>Desert Sprint</option>
              <option>City Rush</option>
            </select>
          </div>
          <div className="flex justify-between items-center">
            <span>Laps:</span>
            <select className="bg-gray-700 rounded px-3 py-2">
              <option>3</option>
              <option>5</option>
              <option>7</option>
            </select>
          </div>
          <div className="flex justify-between items-center">
            <span>Items:</span>
            <label className="inline-flex items-center">
              <input type="checkbox" className="form-checkbox h-5 w-5" />
              <span className="ml-2">Enabled</span>
            </label>
          </div>
        </div>
      </div>

      <div className="w-full max-w-2xl bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-semibold mb-4">Players</h2>
        <div className="space-y-2">
          <div className="flex justify-between items-center bg-gray-700 p-3 rounded">
            <span>Player 1 (You)</span>
            <span className="text-green-400">Ready</span>
          </div>
          <div className="flex justify-between items-center bg-gray-700 p-3 rounded opacity-50">
            <span>Waiting for players...</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <Button onClick={onBack} variant="secondary">
          Back to Menu
        </Button>
        <Button onClick={onStartRace} variant="primary">
          Start Race
        </Button>
      </div>
    </div>
  );
};
