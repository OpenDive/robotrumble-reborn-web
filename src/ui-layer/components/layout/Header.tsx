import React from 'react';
import { Button } from '../shared/Button';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onBack,
  backLabel = 'Back to Menu'
}) => {
  return (
    <div className="w-full border-b border-white/5">
      <div className="w-full max-w-[1440px] mx-auto px-6 py-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            {subtitle && (
              <p className="text-lg text-white/60 mt-1">{subtitle}</p>
            )}
          </div>
          {onBack && (
            <Button 
              variant="secondary" 
              onClick={onBack}
              className="bg-gray-800/80 hover:bg-gray-700/80 px-6"
            >
              {backLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}; 