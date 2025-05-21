import React from 'react';

interface MenuButtonProps {
  label: string;
  icon?: React.ReactNode;
  isSelected?: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
}

export const MenuButton: React.FC<MenuButtonProps> = ({
  label,
  icon,
  isSelected = false,
  isHighlighted = false,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        w-full px-6 py-4 mb-3 rounded-xl
        flex items-center gap-4
        transition-all duration-200
        font-bold text-xl
        ${isHighlighted 
          ? 'bg-racing-yellow text-black shadow-[0_0_20px_rgba(255,215,0,0.3)]' 
          : 'bg-black/40 text-white hover:bg-black/60'}
        ${isSelected 
          ? 'ring-2 ring-neon-purple ring-offset-2 ring-offset-black/20' 
          : ''}
        backdrop-blur-sm
        hover:scale-[1.02]
        active:scale-[0.98]
        group
      `}
    >
      {/* Icon container */}
      {icon && (
        <div className={`
          w-8 h-8 flex items-center justify-center
          ${isHighlighted ? 'text-black' : 'text-white'}
        `}>
          {icon}
        </div>
      )}
      
      {/* Label */}
      <span className="flex-1 text-left">{label}</span>

      {/* Hover indicator */}
      <div className={`
        w-2 h-2 rounded-full
        transition-all duration-200
        ${isHighlighted 
          ? 'bg-black scale-100' 
          : 'bg-neon-purple scale-0 group-hover:scale-100'}
      `} />
    </button>
  );
};
