import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({ 
  children,
  className = ''
}) => {
  return (
    <div className="w-full">
      <div className={`w-full max-w-[1440px] mx-auto px-6 ${className}`}>
        {children}
      </div>
    </div>
  );
}; 