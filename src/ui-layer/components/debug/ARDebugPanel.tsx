import React, { useEffect, useState } from 'react';
import { arManager } from '../../../engine-layer/core/ar/ARManager';
import { Stats } from '../../../engine-layer/core/ar/StatsService';

interface MarkerStats extends Stats {
  fps: string;
  frameSkip: number;
  markersDetected: number;
  totalDetections: number;
  errors: number;
}

export const ARDebugPanel: React.FC = () => {
  const [stats, setStats] = useState<MarkerStats | null>(null);

  useEffect(() => {
    const updateInterval = setInterval(() => {
      setStats(arManager.getStats() as MarkerStats);
    }, 100); // Update every 100ms

    return () => clearInterval(updateInterval);
  }, []);

  if (!stats) return null;

  const formatMemory = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

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
          {stats.memoryStats && (
            <>
              <tr>
                <td colSpan={2} className="pt-2 pb-1 text-gray-400 border-t border-gray-700">
                  Memory Usage
                </td>
              </tr>
              <tr>
                <td className="pr-4 text-gray-400">Used:</td>
                <td className="text-right">{formatMemory(stats.memoryStats.usedJSHeapSize)}</td>
              </tr>
              <tr>
                <td className="pr-4 text-gray-400">Total:</td>
                <td className="text-right">{formatMemory(stats.memoryStats.totalJSHeapSize)}</td>
              </tr>
              <tr>
                <td className="pr-4 text-gray-400">Limit:</td>
                <td className="text-right">{formatMemory(stats.memoryStats.jsHeapSizeLimit)}</td>
              </tr>
              <tr>
                <td className="pr-4 text-gray-400">Usage:</td>
                <td className="text-right">
                  {((stats.memoryStats.usedJSHeapSize / stats.memoryStats.totalJSHeapSize) * 100).toFixed(1)}%
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
};
