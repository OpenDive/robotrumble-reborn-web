import React from 'react';

export type StatusType = 'online' | 'busy' | 'offline';

interface StatusDotProps {
  status: StatusType;
  size?: 'sm' | 'md';
  className?: string;
}

const statusColors: Record<StatusType, string> = {
  online: 'bg-[#50C878]',  // success green
  busy: 'bg-[#FFD700]',    // racing yellow
  offline: 'bg-[#FF4C4C]', // racing red
};

export const StatusDot: React.FC<StatusDotProps> = ({ 
  status, 
  size = 'sm',
  className 
}) => {
  return (
    <div 
      className={`rounded-full ${size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'} ${statusColors[status]} animate-pulse-slow relative ${className || ''}`}
    >
      {/* Glow effect */}
      <div 
        className={`absolute inset-0 rounded-full blur-sm -z-10 ${statusColors[status]} opacity-50`} 
      />
    </div>
  );
};
