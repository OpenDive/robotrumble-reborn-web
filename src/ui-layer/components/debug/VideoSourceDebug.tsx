import React, { useState, useEffect, useRef } from 'react';
import { arManager } from '../../../engine-layer/core/ar/ARManager';
import { VideoSourceFactory } from '../../../engine-layer/core/video/VideoSourceFactory';
import { VideoConfig, VideoStats } from '../../../engine-layer/core/video/types';

export function VideoSourceDebug() {
  const [currentSource, setCurrentSource] = useState<string>('webcam');
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Update stats and dimensions every second
    const interval = setInterval(() => {
      const videoSource = arManager.getVideoSource();
      if (videoSource) {
        setStats(videoSource.getStats());
        setDimensions(videoSource.getDimensions());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSourceChange = async (sourceType: string) => {
    let videoConfig: VideoConfig;

    if (sourceType === 'test-video') {
      console.log('Test video clicked', { fileInputRef: fileInputRef.current });
      if (fileInputRef.current) {
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

    const videoUrl = URL.createObjectURL(file);
    const videoConfig: VideoConfig = {
      sourceType: 'test-video',
      test: {
        videoPath: videoUrl,
        loop: true
      }
    };

    try {
      const factory = VideoSourceFactory.getInstance();
      const source = await factory.switchSource(videoConfig);
      await source.start();
      setCurrentSource('test-video');
    } catch (error) {
      console.error('Failed to load video file:', error);
      URL.revokeObjectURL(videoUrl);
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
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
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

      {stats && (
        <div className="text-sm space-y-1">
          <div>FPS: {stats.fps.toFixed(1)}</div>
          <div>Connection: {stats.connectionState}</div>
          <div>Resolution: {dimensions ? `${dimensions.width}x${dimensions.height}` : 'Unknown'}</div>
        </div>
      )}
    </div>
  );
}
