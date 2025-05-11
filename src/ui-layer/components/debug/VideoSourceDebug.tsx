import React, { useState, useEffect, useRef } from 'react';
import { arManager } from '../../../engine-layer/core/ar/ARManager';
import { VideoSourceFactory } from '../../../engine-layer/core/video/VideoSourceFactory';
import { VideoConfig, VideoStats } from '../../../engine-layer/core/video/types';

export function VideoSourceDebug() {
  const [currentSource, setCurrentSource] = useState<string>('webcam');
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentVideoUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Update stats and dimensions every second
    const interval = setInterval(() => {
      const videoSource = arManager.getVideoSource();
      if (videoSource) {
        setStats(videoSource.getStats());
        setDimensions(videoSource.getDimensions());
      }
    }, 1000);

    // Cleanup function
    return () => {
      clearInterval(interval);
      // Clean up any existing video URL
      if (currentVideoUrlRef.current) {
        URL.revokeObjectURL(currentVideoUrlRef.current);
      }
    };
  }, []);

  const handleSourceChange = async (sourceType: string) => {
    let videoConfig: VideoConfig;

    if (sourceType === 'test-video') {
      console.log('Test video clicked', { fileInputRef: fileInputRef.current });
      if (fileInputRef.current) {
        // Reset file input value to allow selecting the same file again
        fileInputRef.current.value = '';
        console.log('Triggering file input click');
        fileInputRef.current.click();
      }
      return;
    }

    videoConfig = {
      sourceType: sourceType as 'webcam' | 'webrtc' | 'test-video',
      webcam: {
        width: 1280,
        height: 720
      }
    };

    try {
      const factory = VideoSourceFactory.getInstance();
      await factory.switchSource(videoConfig);
      setCurrentSource(sourceType);
    } catch (error) {
      console.error('Failed to switch video source:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Clean up previous video URL if it exists
      if (currentVideoUrlRef.current) {
        URL.revokeObjectURL(currentVideoUrlRef.current);
      }

      // Create new video URL
      const videoUrl = URL.createObjectURL(file);
      currentVideoUrlRef.current = videoUrl;

      console.log('VideoSourceDebug: Loading new video file...', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      const videoConfig: VideoConfig = {
        sourceType: 'test-video',
        test: {
          videoPath: videoUrl,
          loop: true
        }
      };

      const factory = VideoSourceFactory.getInstance();
      const source = await factory.switchSource(videoConfig);
      await source.start();
      setCurrentSource('test-video');
      
      console.log('VideoSourceDebug: Video file loaded successfully');
    } catch (error) {
      console.error('Failed to load video file:', error);
      // Clean up URL on error
      if (currentVideoUrlRef.current) {
        URL.revokeObjectURL(currentVideoUrlRef.current);
        currentVideoUrlRef.current = null;
      }
    }
  };

  return (
    <div className="fixed bottom-4 left-4 bg-gray-900 bg-opacity-90 p-4 rounded-lg text-white z-50 pointer-events-auto">
      <h3 className="text-lg font-semibold mb-2">Video Source Debug</h3>
      
      <div className="space-x-2 mb-4">
        <button
          className={`px-3 py-1 rounded ${currentSource === 'webcam' ? 'bg-blue-600' : 'bg-gray-700'}`}
          onClick={() => handleSourceChange('webcam')}
        >
          Webcam
        </button>
        <button
          className={`px-3 py-1 rounded ${currentSource === 'test-video' ? 'bg-blue-600' : 'bg-gray-700'}`}
          onClick={() => handleSourceChange('test-video')}
        >
          Test Video
        </button>
        <button
          className={`px-3 py-1 rounded ${currentSource === 'webrtc' ? 'bg-blue-600' : 'bg-gray-700'} opacity-50 cursor-not-allowed`}
          disabled
          title="Coming soon"
        >
          WebRTC
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Stats display */}
      <div className="text-sm space-y-1">
        <div>Source: {currentSource}</div>
        {stats && (
          <>
            <div>FPS: {stats.fps.toFixed(1)}</div>
            <div>State: {stats.connectionState}</div>
            {stats.lastError && <div className="text-red-400">Error: {stats.lastError}</div>}
          </>
        )}
        {dimensions && (
          <div>
            Size: {dimensions.width}x{dimensions.height}
          </div>
        )}
      </div>
    </div>
  );
}
