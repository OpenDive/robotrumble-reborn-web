import React, { useEffect, useState } from 'react';
import { arManager } from '../../../engine-layer/core/ar/ARManager';

interface MarkerStats {
  fps: string;
  markersDetected: number;
  totalDetections: number;
  errors: number;
  frameSkip: number;
}

export const ARDebugPanel: React.FC = () => {
  const [stats, setStats] = useState<MarkerStats | null>(null);

  useEffect(() => {
    const updateInterval = setInterval(() => {
      setStats(arManager.getMarkerStats());
    }, 100); // Update every 100ms

    return () => clearInterval(updateInterval);
  }, []);

  if (!stats) return null;

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-4 rounded-lg font-mono text-sm">
      <h3 className="font-bold mb-2">AR Debug Info</h3>
      <table className="w-full">
        <tbody>
          <tr>
            <td className="pr-4 text-gray-400">FPS:</td>
            <td className="text-right">{stats.fps}</td>
          </tr>
          <tr>
            <td className="pr-4 text-gray-400">Current Markers:</td>
            <td className="text-right">{stats.markersDetected}</td>
          </tr>
          <tr>
            <td className="pr-4 text-gray-400">Total Detected:</td>
            <td className="text-right">{stats.totalDetections}</td>
          </tr>
          <tr>
            <td className="pr-4 text-gray-400">Errors:</td>
            <td className="text-right text-red-400">{stats.errors}</td>
          </tr>
          <tr>
            <td className="pr-4 text-gray-400">Frame Skip:</td>
            <td className="text-right">{stats.frameSkip}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
