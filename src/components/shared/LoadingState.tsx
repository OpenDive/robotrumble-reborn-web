import React from 'react';

interface LoadingStateProps {
  message?: string;
  variant?: 'fullscreen' | 'inline' | 'overlay';
  size?: 'small' | 'medium' | 'large';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  variant = 'inline',
  size = 'medium',
}) => {
  const containerClasses = {
    inline: 'flex flex-col items-center justify-center',
    fullscreen: 'fixed inset-0 bg-game-900 flex flex-col items-center justify-center z-50',
    overlay: 'absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center',
  }[variant];

  const spinnerSizes = {
    small: 'w-6 h-6',
    medium: 'w-10 h-10',
    large: 'w-16 h-16',
  }[size];

  const textSizes = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  }[size];

  return (
    <div className={containerClasses}>
      <div className="relative">
        <svg
          className={`${spinnerSizes} animate-spin text-primary-500`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      {message && (
        <div className={`mt-4 font-medium text-white/90 ${textSizes}`}>
          {message}
        </div>
      )}
    </div>
  );
};
