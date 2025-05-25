import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaWallet, FaChevronLeft } from 'react-icons/fa';
import { useAuth } from '../../../shared/contexts/AuthContext';
import GoogleSignIn from '../shared/GoogleSignIn';

interface LoginScreenProps {
  onLoginComplete: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginComplete }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState('');

  // If user is already logged in, call onLoginComplete
  React.useEffect(() => {
    if (user) {
      onLoginComplete();
    }
  }, [user, onLoginComplete]);

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
    <div className="min-h-screen flex items-center justify-center bg-[#0B0B1A] relative overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2">
        <div 
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage: `
              linear-gradient(to right, #B24BF3 1px, transparent 1px),
              linear-gradient(to bottom, #B24BF3 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            transform: 'perspective(1000px) rotateX(60deg)',
            transformOrigin: 'center center',
          }}
        />
      </div>

      {/* Animated glow overlay */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(circle at 50% 50%, #B24BF3 0%, transparent 50%),
            radial-gradient(circle at 0% 0%, #4C9EFF 0%, transparent 40%),
            radial-gradient(circle at 100% 100%, #FFD700 0%, transparent 40%)
          `
        }}
      />

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#0B0B1A]/90 to-[#0B0B1A]"/>
      
      {/* Main container */}
      <div className="relative max-w-md w-full space-y-8 p-8 bg-black/40 backdrop-blur-md rounded-3xl border border-white/5 shadow-[0_0_50px_rgba(178,75,243,0.3)] animate-float z-10">
        <div className="text-center relative">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80">ROBOT KARTS</h1>
          <div className="h-1 w-32 mx-auto bg-racing-yellow rounded-full mt-4 relative">
            <div className="absolute inset-0 animate-pulse-slow bg-racing-yellow blur-md opacity-50" />
          </div>
        </div>
        
        <div className="space-y-4">
          <GoogleSignIn />

          <button
            onClick={handleWalletConnect}
            className="relative w-full group flex items-center justify-center px-6 py-4 text-lg font-bold rounded-xl text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-all duration-300 overflow-hidden"
          >
            {/* Animated background gradient */}
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-neon-purple/20 via-white/5 to-neon-purple/20"
              style={{
                backgroundSize: '200% 100%',
                animation: 'shimmer 2s linear infinite',
              }}
            />
            <div className="relative flex items-center gap-4 w-full">
              <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-5deg]">
                <FaWallet />
              </div>
              <span className="flex-1 text-left transition-transform duration-300 group-hover:translate-x-1">Connect Wallet</span>
              <div className="w-2 h-8 rounded-full bg-neon-purple scale-y-0 group-hover:scale-y-100 transition-transform duration-300" />
            </div>
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Enter referral code (optional)"
            value={referralCode}
            onChange={handleReferralChange}
            className="w-full px-6 py-4 text-lg font-medium rounded-xl text-white bg-black/40 placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-neon-purple focus:ring-opacity-50 transition-all duration-300 backdrop-blur-sm"
          />
        </div>

        <button
          onClick={handleBackToWelcome}
          className="group flex items-center text-sm font-medium text-white/60 hover:text-white transition-colors duration-300"
        >
          <FaChevronLeft className="mr-2 group-hover:-translate-x-1 transition-transform duration-300" />
          Back to Welcome
        </button>
      </div>
    </div>
  );
};
