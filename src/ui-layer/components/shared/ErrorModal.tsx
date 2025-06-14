import React from 'react';

interface ErrorModalProps {
  message: string;
  onRetry?: () => void;
  onBack?: () => void;
  onDismiss?: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({ message, onRetry, onBack, onDismiss }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full mx-4 border border-red-500/20">
        <div className="text-center">
          {/* Error Icon */}
          <div className="w-16 h-16 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          {/* Error Message */}
          <h3 className="text-xl font-semibold text-white mb-2">Connection Failed</h3>
          <p className="text-red-400 mb-6 leading-relaxed">{message}</p>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium"
              >
                Try Again
              </button>
            )}
            
            {onBack && (
              <button
                onClick={onBack}
                className="px-6 py-2 text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded-lg transition-colors duration-200"
              >
                Go Back
              </button>
            )}
            
            {onDismiss && !onRetry && !onBack && (
              <button
                onClick={onDismiss}
                className="px-6 py-2 text-white/70 hover:text-white border border-white/20 hover:border-white/40 rounded-lg transition-colors duration-200"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 