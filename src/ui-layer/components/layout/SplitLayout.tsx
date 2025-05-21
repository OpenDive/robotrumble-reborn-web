import React from 'react';

interface SplitLayoutProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  className?: string;
}

export const SplitLayout: React.FC<SplitLayoutProps> = ({
  leftContent,
  rightContent,
  className = '',
}) => {
  return (
    <div className={`w-full h-full grid grid-cols-[1.2fr_1fr] ${className}`}>
      {/* Left panel - Display area */}
      <div className="relative w-full h-full overflow-hidden">
        {leftContent}
      </div>

      {/* Right panel - Menu area */}
      <div className="relative w-full h-full p-8 flex flex-col">
        {rightContent}
      </div>
    </div>
  );
};
