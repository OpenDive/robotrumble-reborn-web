import React from 'react';
import { Button } from './Button';

interface JoinGameViewProps {
  onJoin: () => void;
  sessionName?: string;
}

export const JoinGameView: React.FC<JoinGameViewProps> = ({ onJoin, sessionName }) => {
  return (
    <div className="w-full h-screen bg-[#0B0B1A] relative overflow-hidden flex items-center justify-center">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#0B0B1A]/80 to-[#0B0B1A]"/>
      
      <div className="relative z-10 text-center text-white">
        {/* Game Icon */}
        <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        
        {/* Title */}
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Crossy Robot Control
        </h1>
        
        {/* Session Name */}
        {sessionName && (
          <p className="text-xl text-white/70 mb-8">
            {sessionName}
          </p>
        )}
        
        {/* Description */}
        <p className="text-lg text-white/60 mb-8 max-w-md mx-auto leading-relaxed">
          Join the augmented reality robot control experience. Watch the live stream and control the robot through the grid.
        </p>
        
        {/* Features */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 text-sm text-white/50">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Live Video Stream
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Real-time Control
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            AR Overlay
          </div>
        </div>
        
        {/* Join Button */}
        <Button
          variant="primary"
          size="large"
          onClick={onJoin}
          className="!px-12 !py-4 !text-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
        >
          Join Crossy Robot Game
        </Button>
        
        {/* Disclaimer */}
        <p className="text-xs text-white/40 mt-8 max-w-sm mx-auto">
          Requires WebSocket connection to robot control server. Video streaming and robot control must both be available.
        </p>
      </div>
    </div>
  );
}; 