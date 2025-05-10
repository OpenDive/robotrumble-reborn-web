import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
}) => {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className={`game-card max-w-[90vw] max-h-[90vh] w-[500px] ${className}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-game-700">
          {title && (
            <h2 className="text-xl font-semibold text-white m-0">
              {title}
            </h2>
          )}
          <button
            className="p-2 text-game-300 hover:text-white hover:bg-game-700 rounded-md transition-colors"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto max-h-[calc(90vh-100px)]">
          {children}
        </div>
      </div>
    </div>
  );
};
