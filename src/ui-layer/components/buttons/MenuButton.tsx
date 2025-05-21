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
        relative w-full px-6 py-4 rounded-xl
        flex items-center gap-4
        transition-all duration-300
        font-bold text-xl
        overflow-hidden
        ${isHighlighted 
          ? 'bg-racing-yellow text-black shadow-[0_0_30px_rgba(255,215,0,0.3)]' 
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
      {/* Animated background gradient */}
      <div 
        className={`
          absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
          ${isHighlighted 
            ? 'bg-gradient-to-r from-racing-yellow via-white/10 to-racing-yellow' 
            : 'bg-gradient-to-r from-neon-purple/20 via-white/5 to-neon-purple/20'}
        `}
        style={{
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s linear infinite',
        }}
      />
      
      {/* Button content wrapper */}
      <div className="relative flex items-center gap-4 w-full"
    >
      {/* Icon container */}
      {icon && (
        <div className={`
          w-10 h-10 flex items-center justify-center
          rounded-lg
          transition-transform duration-300
          group-hover:scale-110
          group-hover:rotate-[-5deg]
          ${isHighlighted 
            ? 'text-black bg-black/10' 
            : 'text-white bg-white/5'}
        `}>
          {icon}
        </div>
      )}
      
      {/* Label */}
      <span className="flex-1 text-left transition-transform duration-300 group-hover:translate-x-1">{label}</span>

      {/* Hover indicator */}
      <div className={`
        w-2 h-8 rounded-full
        transition-all duration-300
        ${isHighlighted 
          ? 'bg-black/50 scale-y-100' 
          : 'bg-neon-purple scale-y-0 group-hover:scale-y-100'}
      `} />
      </div>
    </button>
  );
};
