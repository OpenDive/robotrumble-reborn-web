import React, { useEffect } from 'react';
import './Modal.css';

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
    <div className="rr-modal-overlay" onClick={onClose}>
      <div 
        className={`rr-modal ${className}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="rr-modal__header">
          {title && <h2 className="rr-modal__title">{title}</h2>}
          <button
            className="rr-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="rr-modal__content">
          {children}
        </div>
      </div>
    </div>
  );
};
