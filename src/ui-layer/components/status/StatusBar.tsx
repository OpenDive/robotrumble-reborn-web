import React from 'react';
import { IconType } from 'react-icons';
import { StatusItem } from './StatusItem';

export interface StatusBarItem {
  id: string;
  icon?: IconType;
  label: string;
  value: string | number;
  highlight?: boolean;
}

interface StatusBarProps {
  items: StatusBarItem[];
  animate?: boolean;
  className?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  items,
  animate = false,
  className
}) => {
  return (
    <div 
      className={`flex items-center gap-6 px-6 py-3 bg-black/20 backdrop-blur-sm border-t border-white/5 ${animate ? 'animate-float' : ''} ${className || ''}`}
    >
      {items.map((item) => (
        <StatusItem
          key={item.id}
          icon={item.icon}
          label={item.label}
          value={item.value}
          highlight={item.highlight}
        />
      ))}
    </div>
  );
};
