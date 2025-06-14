import React from 'react';

interface LoadingModalProps {
  message: string;
  onCancel?: () => void;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({ message, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full mx-4 border border-white/10">
        <div className="text-center">
          {/* Loading Spinner */}
          <div className="w-16 h-16 mx-auto mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
          </div>
          
          {/* Loading Message */}
          <h3 className="text-xl font-semibold text-white mb-2">Connecting...</h3>
          <p className="text-white/70 mb-6">{message}</p>
          
          {/* Progress Dots */}
          <div className="flex justify-center space-x-2 mb-6">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
          
          {/* Cancel Button */}
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-2 text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded-lg transition-colors duration-200"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 