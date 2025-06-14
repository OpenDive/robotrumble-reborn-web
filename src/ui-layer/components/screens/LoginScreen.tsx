import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChevronLeft } from 'react-icons/fa';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { SuiWalletConnect } from '../shared/SuiWalletConnect';

interface LoginScreenProps {
  onLoginComplete: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginComplete }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState('');
  const [hasNavigated, setHasNavigated] = useState(false);

  // If user is already logged in, call onLoginComplete
  React.useEffect(() => {
    if (user && !hasNavigated) {
      console.log('✅ LoginScreen: User detected, navigating to drivers license');
      setHasNavigated(true);
      onLoginComplete();
    } else if (!user && hasNavigated) {
      // Reset flag if user logs out
      setHasNavigated(false);
    }
  }, [user, onLoginComplete, hasNavigated]);

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
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80">Robot Rumble</h1>
          <div className="h-1 w-32 mx-auto bg-racing-yellow rounded-full mt-4 relative">
            <div className="absolute inset-0 animate-pulse-slow bg-racing-yellow blur-md opacity-50" />
          </div>
        </div>
        
        <div className="space-y-4">
          {/* Game Pass - Featured prominently */}
          <div className="mb-6">
            <button 
              onClick={() => navigate('/team-registration')}
              className="relative w-full group flex items-center justify-center px-6 py-4 text-lg font-bold rounded-xl text-white bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 hover:from-purple-500 hover:via-blue-500 hover:to-purple-500 transition-all duration-300 overflow-hidden border border-purple-400/50 shadow-[0_0_30px_rgba(147,51,234,0.4)]"
            >
              {/* Animated background */}
              <div 
                className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-300"
                style={{
                  background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 3s linear infinite',
                }}
              />
              
              {/* Content */}
              <div className="relative flex items-center justify-center gap-3">
                <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <span className="text-purple-900 font-bold text-sm">✨</span>
                </div>
                <span>Get Game Pass</span>
                <div className="text-xs bg-yellow-400 text-purple-900 px-2 py-1 rounded-full font-black">
                  PREMIUM
                </div>
              </div>
            </button>
            
            {/* Description */}
            <p className="text-center text-white/60 text-sm mt-2">
              Stake 1 SUI • Join a team • Get camera & mic privileges
            </p>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-black/40 text-white/60 rounded-full">or continue as guest</span>
            </div>
          </div>

          <SuiWalletConnect />
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
      </div>
    </div>
  );
};
