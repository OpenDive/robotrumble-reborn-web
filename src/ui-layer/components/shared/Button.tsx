import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  onClick,
  children,
  className = '',
}) => {
  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg',
  }[size];

  const variantClasses = {
    primary: 'game-button--primary',
    secondary: 'game-button--secondary',
    danger: 'bg-gradient-game from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white',
  }[variant];

  const baseClasses = [
    'inline-flex items-center justify-center font-medium rounded-md transition-all duration-200',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    sizeClasses,
    variantClasses,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      className={baseClasses}
      onClick={onClick}
      disabled={disabled || loading}
      type="button"
    >
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="animate-spin h-5 w-5 text-white"
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
      ) : (
        children
      )}
    </button>
  );
};
