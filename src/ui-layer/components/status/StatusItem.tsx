import React from 'react';
import { IconType } from 'react-icons';

interface StatusItemProps {
  icon?: IconType;
  label: string;
  value: string | number;
  highlight?: boolean;
  className?: string;
}

export const StatusItem: React.FC<StatusItemProps> = ({
  icon: Icon,
  label,
  value,
  highlight = false,
  className
}) => {
  return (
    <div 
      className={`flex items-center gap-2 ${highlight ? 'text-[#FFD700]' : 'text-white/80'} ${className || ''}`}
    >
      {Icon && (
        <div className="relative">
          <Icon className="text-lg" />
          {/* Icon glow */}
          <div className="absolute inset-0 blur-sm opacity-50" />
        </div>
      )}
      <span className="font-medium">{label}:</span>
      <span className={`font-bold ${highlight ? 'text-[#FFD700]' : 'text-white'}`}>
        {value}
      </span>
    </div>
  );
};
