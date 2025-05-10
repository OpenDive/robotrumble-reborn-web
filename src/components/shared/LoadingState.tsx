import React from 'react';
import './LoadingState.css';

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
  const baseClass = 'rr-loading';
  const classes = [
    baseClass,
    `${baseClass}--${variant}`,
    `${baseClass}--${size}`,
  ].join(' ');

  return (
    <div className={classes}>
      <div className={`${baseClass}__spinner`}>
        <svg viewBox="0 0 50 50">
          <circle
            className={`${baseClass}__circle`}
            cx="25"
            cy="25"
            r="20"
            fill="none"
            strokeWidth="5"
          />
        </svg>
      </div>
      {message && <div className={`${baseClass}__message`}>{message}</div>}
    </div>
  );
};
