import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaGoogle, FaWallet, FaChevronLeft } from 'react-icons/fa';

interface LoginScreenProps {
  onLoginComplete: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginComplete }) => {
  const navigate = useNavigate();
  const [referralCode, setReferralCode] = useState('');

  const handleGoogleLogin = () => {
    // TODO: Implement Google login
    console.log('Google login clicked');
    onLoginComplete();
  };

  const handleWalletConnect = () => {
    // TODO: Implement wallet connection
    console.log('Wallet connect clicked');
    onLoginComplete();
  };

  const handleReferralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReferralCode(e.target.value);
  };

  const handleBackToWelcome = () => {
    navigate('/welcome');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-radial from-gray-900 via-gray-800 to-gray-900 p-4 overflow-hidden">
      {/* Racing pattern overlay */}
      <div className="absolute inset-0 bg-racing-pattern opacity-5 animate-pulse-slow"></div>
      
      {/* Main container */}
      <div className="relative max-w-md w-full space-y-8 p-8 bg-gray-800/80 backdrop-blur-sm rounded-3xl shadow-[0_0_50px_-12px_rgba(0,255,149,0.25)] border border-neon-glow animate-float">
        <div className="text-center relative">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-racing-blue via-racing-green to-racing-yellow animate-glow mb-2">RobotRumble</h1>
          <h2 className="text-xl font-bold text-neon-blue mb-8">Login</h2>
        </div>
        
        <div className="space-y-4">
          <button 
            onClick={handleGoogleLogin}
            className="w-full group flex items-center justify-center px-6 py-4 text-lg font-bold rounded-2xl text-white bg-neon-purple hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neon-purple transition-all duration-200 active:animate-button-press shadow-[0_0_20px_-5px_rgba(178,75,243,0.5)] hover:shadow-[0_0_30px_-5px_rgba(178,75,243,0.8)]"
          >
            <FaGoogle className="mr-3" /> Login with Google
          </button>

          <button 
            onClick={handleWalletConnect}
            className="w-full group flex items-center justify-center px-6 py-4 text-lg font-bold rounded-2xl text-white bg-racing-blue hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-racing-blue transition-all duration-200 active:animate-button-press shadow-[0_0_20px_-5px_rgba(76,158,255,0.5)] hover:shadow-[0_0_30px_-5px_rgba(76,158,255,0.8)]"
          >
            <FaWallet className="mr-3" /> Connect Wallet
          </button>
        </div>

        <div className="mt-6">
          <input
            type="text"
            placeholder="Enter Referral Code"
            value={referralCode}
            onChange={handleReferralChange}
            className="w-full px-6 py-4 text-lg border-2 border-gray-600 rounded-2xl bg-gray-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-neon-blue focus:border-transparent transition-all duration-200 backdrop-blur-sm"
          />
        </div>

        <button 
          onClick={handleBackToWelcome}
          className="mt-8 w-full flex items-center justify-center px-4 py-2 text-base font-medium text-gray-400 hover:text-neon-blue focus:outline-none transition-colors group"
        >
          <FaChevronLeft className="mr-2 transform group-hover:-translate-x-1 transition-transform" /> Back to Welcome
        </button>
      </div>
    </div>
  );
};
