import React, { useEffect } from 'react';
import { useAuthCallback } from '@mysten/enoki/react';
import { useNavigate } from 'react-router-dom';

export default function AuthCallbackScreen() {
  const navigate = useNavigate();
  const { handled } = useAuthCallback(); // This hook handles the OAuth callback automatically

  useEffect(() => {
    console.log('🔄 Auth callback handled:', handled);
    
    if (handled) {
      console.log('✅ OAuth callback processed successfully, redirecting to home');
      // Redirect to home page after successful authentication
      navigate('/', { replace: true });
    }
  }, [handled, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Completing Sign In...
        </h2>
        <p className="text-gray-600">
          Please wait while we complete your authentication.
        </p>
      </div>
    </div>
  );
} 