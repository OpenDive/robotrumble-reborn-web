import React, { useState } from 'react';
import { SplitLayout } from '../layout/SplitLayout';
import { MenuButton } from '../buttons/MenuButton';
import { NavigationButton } from '../buttons/NavigationButton';
import { FaUser, FaUsers, FaInfoCircle, FaStar } from 'react-icons/fa';

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
    <div className="w-full h-full bg-gradient-to-br from-game-900 to-game-950">
      <SplitLayout
        leftContent={
          <div className="w-full h-full flex items-center justify-center">
            {/* Placeholder for 3D model */}
            <div className="w-64 h-64 rounded-full bg-game-800 animate-float" />
          </div>
        }
        rightContent={
          <div className="flex flex-col h-full">
            {/* Game logo */}
            <div className="mb-8">
              <h1 className="text-4xl font-black text-white text-center mb-2">
                ROBOT KARTS
              </h1>
              <div className="h-1 w-32 mx-auto bg-racing-yellow rounded-full" />
            </div>

            {/* Menu options */}
            <div className="flex-1 space-y-2">
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
            <div className="mt-auto mb-4 flex justify-between text-sm text-white/60">
              <span>Signal: Strong</span>
              <span>Players Online: 42</span>
            </div>
          </div>
        }
      />

      {/* Navigation buttons */}
      <NavigationButton
        label="Back"
        buttonKey="B"
        position="left"
        onClick={onBack}
      />
      <NavigationButton
        label="OK"
        buttonKey="A"
        position="right"
        onClick={() => handleOptionSelect(selectedOption)}
      />
    </div>
  );
};
