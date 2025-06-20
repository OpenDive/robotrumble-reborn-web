import React from 'react';
import { LoginScreen } from './LoginScreen';

interface VideoIntroScreenProps {
  onLoginComplete: () => void;
}

export const VideoIntroScreen: React.FC<VideoIntroScreenProps> = ({ onLoginComplete }) => {
  return (
    <div className="relative">
      {/* Landing page with greyed out overlay */}
      <div className="filter grayscale brightness-75 pointer-events-none">
        <LoginScreen onLoginComplete={onLoginComplete} />
      </div>
      
      {/* Popup overlay */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-xs flex items-center justify-center z-50">
        <div className="bg-[#0B0B1A]/80 backdrop-blur-md border border-purple-400/50 rounded-2xl p-8 max-w-md mx-4 text-center shadow-[0_0_50px_rgba(178,75,243,0.4)]">
          <div className="mb-6">
            <div className="mx-auto mb-4">
              <img 
                src="/assets/robot_racing_sideview_transparent.png" 
                alt="Robot racing tournament"
                className="w-16 h-16 object-contain mx-auto"
              />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Thank You to Our Playtest Community!</h2>
            <p className="text-white/70">
              Thank you to everyone that participated in our playtest! Demo available upon request as we need to setup the physical robot etc.
            </p>
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
          
          <div className="text-sm text-white/50">
            Follow us for updates and demos...
          </div>
        </div>
      </div>
    </div>
  );
}; 