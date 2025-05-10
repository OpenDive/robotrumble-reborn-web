import React from 'react';
import { LoadingState } from '../shared/LoadingState';

interface AppLayoutProps {
  children: React.ReactNode;
  isLoading?: boolean;
  loadingMessage?: string;
  className?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  isLoading = false,
  loadingMessage,
  className = '',
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-game-900 to-game-800 text-white">
      <div className={`relative w-full ${className}`}>
        {isLoading ? (
          <LoadingState
            variant="fullscreen"
            size="large"
            message={loadingMessage}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
};
