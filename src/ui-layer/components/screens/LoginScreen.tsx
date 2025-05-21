import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/Button';
import './LoginScreen.css';

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
    <div className="login-screen">
      <div className="login-container">
        <h1>RobotRumble</h1>
        <h2>Login</h2>
        
        <div className="login-options">
          <Button 
            onClick={handleGoogleLogin}
            className="google-login-btn"
          >
            Login with Google
          </Button>

          <Button 
            onClick={handleWalletConnect}
            className="wallet-connect-btn"
          >
            Connect Wallet
          </Button>
        </div>

        <div className="referral-section">
          <input
            type="text"
            placeholder="Enter Referral Code"
            value={referralCode}
            onChange={handleReferralChange}
            className="referral-input"
          />
        </div>

        <Button 
          onClick={handleBackToWelcome}
          className="back-button"
        >
          Back to Welcome
        </Button>
      </div>
    </div>
  );
};
