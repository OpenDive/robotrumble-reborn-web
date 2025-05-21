import React from 'react';
import { FaUsers, FaGamepad, FaTrophy, FaGlobe } from 'react-icons/fa';
import { StatusBar, StatusBarItem } from '../status/StatusBar';
import { StatusDot, StatusType } from '../status/StatusDot';

interface GameStatusBarProps {
  mode?: 'compact' | 'full';
  className?: string;
}

export const GameStatusBar: React.FC<GameStatusBarProps> = ({
  mode = 'full',
  className
}) => {
  // Example data - in real app, this would come from props or context
  const statusItems: StatusBarItem[] = [
    {
      id: 'players',
      icon: FaUsers,
      label: 'Players Online',
      value: '42',
      highlight: true
    },
    {
      id: 'races',
      icon: FaGamepad,
      label: 'Active Races',
      value: '8'
    },
    {
      id: 'robots',
      icon: FaTrophy,
      label: 'Available Robots',
      value: '12'
    },
    {
      id: 'ping',
      icon: FaGlobe,
      label: 'Global Ping',
      value: '85ms'
    }
  ];

  const connectionStatus: StatusType = 'online';

  return (
    <div className={`fixed bottom-0 left-0 right-0 flex items-center justify-between ${className || ''}`}>
      <StatusBar 
        items={mode === 'compact' ? statusItems.slice(0, 2) : statusItems}
        animate={false}
        className="flex-1"
      />
      
      <div className="flex items-center gap-2 px-4">
        <StatusDot status={connectionStatus} />
        <span className="text-sm text-white/80">
          Signal: Strong
        </span>
      </div>
    </div>
  );
};
