import React, { useState } from 'react';
import { SplitLayout } from '../layout/SplitLayout';
import { MenuButton } from '../buttons/MenuButton';
import { NavigationButton } from '../buttons/NavigationButton';
import { FaUser, FaUsers, FaInfoCircle, FaStar } from 'react-icons/fa';
import SuiWalletConnect from '../shared/SuiWalletConnect';

interface GameMenuScreenProps {
  onBack?: () => void;
  onStartSinglePlayer?: () => void;
  onStartMultiplayer?: () => void;
  onShowInfo?: () => void;
  onShowCredits?: () => void;
}

type MenuOption = 'single' | 'multi' | 'info' | 'credits';

export const GameMenuScreen: React.FC<GameMenuScreenProps> = ({
  onBack,
  onStartSinglePlayer,
  onStartMultiplayer,
  onShowInfo,
  onShowCredits,
}) => {
  const [selectedOption, setSelectedOption] = useState<MenuOption>('multi');

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.code) {
        case 'ArrowUp':
          setSelectedOption(current => {
            const options: MenuOption[] = ['single', 'multi', 'info', 'credits'];
            const currentIndex = options.indexOf(current);
            return options[Math.max(0, currentIndex - 1)];
          });
          break;
        case 'ArrowDown':
          setSelectedOption(current => {
            const options: MenuOption[] = ['single', 'multi', 'info', 'credits'];
            const currentIndex = options.indexOf(current);
            return options[Math.min(options.length - 1, currentIndex + 1)];
          });
          break;
        case 'Enter':
          handleOptionSelect(selectedOption);
          break;
        case 'Escape':
          onBack?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedOption, onBack]);

  const handleOptionSelect = (option: MenuOption) => {
    switch (option) {
      case 'single':
        onStartSinglePlayer?.();
        break;
      case 'multi':
        onStartMultiplayer?.();
        break;
      case 'info':
        onShowInfo?.();
        break;
      case 'credits':
        onShowCredits?.();
        break;
    }
  };

  return (
    <div className="w-full h-full bg-[#0B0B1A] relative overflow-hidden">
      {/* Background grid effect */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, #B24BF3 1px, transparent 1px),
            linear-gradient(to bottom, #B24BF3 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          transform: 'perspective(500px) rotateX(60deg)',
          transformOrigin: 'center 150%',
        }}
      />

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#0B0B1A]/80 to-[#0B0B1A]"/>
      
      {/* Wallet address button - positioned at top right */}
      <div className="absolute top-6 right-6 z-50">
        <SuiWalletConnect />
      </div>

      <SplitLayout
        className="relative z-10"
        leftContent={
          <div className="w-full h-full flex items-center justify-center">
            {/* Placeholder for 3D model with glow effect */}
            <div className="relative group animate-float">
              <div className="absolute inset-0 bg-neon-purple blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-500" />
              <div className="w-80 h-80 rounded-full bg-gradient-to-br from-game-800 to-game-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-radial from-neon-purple/20 to-transparent opacity-75" />
                <div 
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, white 1px, transparent 1px),
                      linear-gradient(to bottom, white 1px, transparent 1px)
                    `,
                    backgroundSize: '20px 20px',
                  }}
                />
              </div>
            </div>
          </div>
        }
        rightContent={
          <div className="flex flex-col h-full max-w-md mx-auto px-4">
            {/* Yellow accent line */}
            <div className="absolute top-0 right-0 w-32 h-1 bg-racing-yellow rounded-full transform -translate-y-2" />
            {/* Game logo */}
            <div className="mb-12 mt-8 relative">
              <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80 text-center">
                ROBOT KARTS
              </h1>
              <div className="h-1 w-32 mx-auto bg-racing-yellow rounded-full mt-4 relative">
                <div className="absolute inset-0 animate-pulse-slow bg-racing-yellow blur-md opacity-50" />
              </div>
            </div>

            {/* Menu options */}
            <div className="flex-1 space-y-3 relative">
              {/* Menu background glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-neon-purple/5 via-transparent to-transparent rounded-3xl -m-4" />
              <MenuButton
                label="Single Player"
                icon={<FaUser />}
                isSelected={selectedOption === 'single'}
                onClick={() => handleOptionSelect('single')}
              />
              <MenuButton
                label="Multiplayer"
                icon={<FaUsers />}
                isSelected={selectedOption === 'multi'}
                isHighlighted
                onClick={() => handleOptionSelect('multi')}
              />
              <MenuButton
                label="Info"
                icon={<FaInfoCircle />}
                isSelected={selectedOption === 'info'}
                onClick={() => handleOptionSelect('info')}
              />
              <MenuButton
                label="Credits"
                icon={<FaStar />}
                isSelected={selectedOption === 'credits'}
                onClick={() => handleOptionSelect('credits')}
              />
            </div>

            {/* Connection status */}
            <div className="mt-auto pt-8 pb-4">
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-racing-green animate-pulse" />
                  <span className="text-sm font-medium text-white/80">Signal: Strong</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/80">42 Players Online</span>
                  <div className="w-2 h-2 rounded-full bg-racing-blue animate-pulse-slow" />
                </div>
              </div>
            </div>
          </div>
        }
      />

      {/* Navigation buttons - only show OK button now */}
      <NavigationButton
        label="OK"
        buttonKey="A"
        position="right"
        onClick={() => handleOptionSelect(selectedOption)}
      />
    </div>
  );
};
