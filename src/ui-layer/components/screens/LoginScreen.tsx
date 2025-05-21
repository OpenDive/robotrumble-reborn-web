import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const [referralCode, setReferralCode] = useState('');

  const handleGoogleLogin = () => {
    // TODO: Implement Google login
    console.log('Google login clicked');
  };

  const handleWalletConnect = () => {
    // TODO: Implement wallet connection
    console.log('Wallet connect clicked');
  };

  const handleReferralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReferralCode(e.target.value);
  };

  const handleBackToWelcome = () => {
    navigate('/welcome');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="max-w-md w-full space-y-8 p-8 bg-gray-800 rounded-2xl shadow-xl border border-gray-700">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-secondary mb-2">RobotRumble</h1>
          <h2 className="text-xl text-gray-300 mb-8">Login</h2>
        </div>
        
        <div className="space-y-4">
          <button 
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-lg text-gray-900 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            Login with Google
          </button>

          <button 
            onClick={handleWalletConnect}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-600 text-base font-medium rounded-lg text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            Connect Wallet
          </button>
        </div>

        <div className="mt-6">
          <input
            type="text"
            placeholder="Enter Referral Code"
            value={referralCode}
            onChange={handleReferralChange}
            className="w-full px-4 py-3 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
          />
        </div>

        <button 
          onClick={handleBackToWelcome}
          className="mt-8 w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-400 hover:text-white focus:outline-none transition-colors"
        >
          ← Back to Welcome
        </button>
      </div>
    </div>
  );
};
