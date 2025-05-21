import React from 'react';

interface NavigationButtonProps {
  label: string;
  icon?: React.ReactNode;
  buttonKey: string;
  position: 'left' | 'right';
  onClick?: () => void;
}

export const NavigationButton: React.FC<NavigationButtonProps> = ({
  label,
  icon,
  buttonKey,
  position,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-6 ${position === 'left' ? 'left-6' : 'right-6'}
        px-4 py-2 rounded-lg
        flex items-center gap-2
        bg-black/40 backdrop-blur-sm
        text-white font-bold
        hover:bg-black/60
        transition-all duration-200
        group
      `}
    >
      {/* Content wrapper to handle ordering */}
      <div className={`flex items-center gap-2 ${position === 'right' ? 'flex-row-reverse' : ''}`}>
        {/* Icon */}
        {icon && (
          <div className="w-6 h-6 flex items-center justify-center">
            {icon}
          </div>
        )}

        {/* Label */}
        <span>{label}</span>

        {/* Button key indicator */}
        <div className="
          px-2 py-1 rounded
          bg-white/10
          text-sm font-medium
          group-hover:bg-white/20
          transition-colors duration-200
        ">
          {buttonKey}
        </div>
      </div>
    </button>
  );
};
