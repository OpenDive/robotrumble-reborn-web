import React from 'react';

interface CountdownOverlayProps {
  number: number;
  isVisible: boolean;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({ number, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-40 pointer-events-none">
      {/* Background overlay with slight darkening */}
      <div className="absolute inset-0 bg-black/30" />
      
      {/* Get Ready text */}
      <div className="relative flex flex-col items-center gap-4">
        <div className="text-2xl font-bold text-white animate-bounce mb-4">
          Get Ready!
        </div>
        
        {/* Number with animations */}
        <div 
          className="text-8xl font-black text-white animate-number-countdown"
          style={{
            textShadow: `
              0 0 20px rgba(178,75,243,0.8),
              0 0 40px rgba(178,75,243,0.6),
              0 0 60px rgba(178,75,243,0.4)
            `
          }}
        >
          {number}
        </div>
      </div>
    </div>
  );
};
