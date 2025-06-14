import React, { useEffect, useState } from 'react';
import { useCurrentAccount, useCurrentWallet, useDisconnectWallet } from '@mysten/dapp-kit';
import { useEnokiFlow, useZkLogin, useZkLoginSession } from '@mysten/enoki/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { jwtDecode } from 'jwt-decode';
import { FaWallet, FaChevronDown, FaCopy, FaSignOutAlt } from 'react-icons/fa';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id';

// Debug: Log the Google Client ID
console.log('🔑 Google Client ID loaded:', GOOGLE_CLIENT_ID ? 'Yes' : 'No');
console.log('🔑 Client ID preview:', GOOGLE_CLIENT_ID ? `${GOOGLE_CLIENT_ID.substring(0, 8)}...` : 'Not found');

export const SuiWalletConnect: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Enoki Flow hooks
  const enokiFlow = useEnokiFlow();
  const { address: enokiAddress } = useZkLogin();
  const zkLoginSession = useZkLoginSession();

  // Regular wallet hooks
  const currentAccount = useCurrentAccount();
  const { isConnected: isWalletConnected } = useCurrentWallet();
  const { mutate: disconnect } = useDisconnectWallet();

  // Determine connection state
  const isConnected = !!enokiAddress || isWalletConnected;
  const isUsingEnoki = !!enokiAddress;
  const address = enokiAddress || currentAccount?.address;

  // Debug wallet connection state only when it changes
  useEffect(() => {
  console.log('🔍 Wallet Connection State:', {
    isConnected,
    isUsingEnoki,
    address,
    zkLoginSession: !!zkLoginSession,
    jwt: !!zkLoginSession?.jwt
  });
  }, [isConnected, isUsingEnoki, address, zkLoginSession]);

  // Handle Enoki authentication when session is available
  useEffect(() => {
    if (isConnected && zkLoginSession && zkLoginSession.jwt && !user) {
      try {
        const token = zkLoginSession.jwt;
        const decoded = jwtDecode(token) as any;

        console.log('🎯 Processing Enoki authentication:', {
          email: decoded.email,
          address: address
        });

                const authenticatedUser = {
          suiAddress: address!,
          walletAddress: address!,
                  loginMethod: 'google' as const,
          email: decoded.email,
          name: decoded.name || decoded.given_name || 'Enoki User',
          idToken: token,
                };
                
                setUser(authenticatedUser);
        console.log('✅ Enoki user authenticated successfully');
        } catch (error) {
        console.error('❌ Failed to process Enoki authentication:', error);
      }
    }
  }, [isConnected, zkLoginSession, address, user, setUser]);

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'your-google-client-id') {
      console.error('❌ Google Client ID is missing');
      alert('Google Client ID is not configured. Please check your environment variables.');
      return;
    }
    
    try {
      setIsConnecting(true);
      console.log('🚀 Starting Google OAuth flow...');

      // Navigate to auth page first
      navigate('/auth/callback');

      // Create authorization URL
      const protocol = window.location.protocol;
      const host = window.location.host;
      const customRedirectUri = `${protocol}//${host}/auth/callback`;

      console.log('🔗 Using redirect URI:', customRedirectUri);

      const url = await enokiFlow.createAuthorizationURL({
        provider: 'google',
        network: 'testnet', // or 'mainnet' based on your config
        clientId: GOOGLE_CLIENT_ID,
        redirectUrl: customRedirectUri,
        extraParams: {
          scope: ['openid', 'email', 'profile'],
        },
      });

      console.log('🔗 Redirecting to OAuth URL:', url);
      
      // Redirect to the OAuth URL
      window.location.href = url;

    } catch (error) {
      console.error('❌ Failed to start OAuth flow:', error);
      setIsConnecting(false);
      alert('Failed to start sign-in process. Please try again.');
    }
  };

  const handleDisconnect = () => {
    if (isUsingEnoki) {
      enokiFlow.logout();
    } else {
      disconnect();
    }
    setUser(null);
    setShowDropdown(false);
    console.log('🔌 Wallet disconnected');
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      console.log('Address copied to clipboard');
    }
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.wallet-dropdown')) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  if (isConnected && user) {
    return (
      <div className="relative wallet-dropdown">
        <button
          onClick={toggleDropdown}
          className="flex items-center gap-2 px-3 py-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-lg border border-white/10 transition-all duration-200 text-white group"
        >
          <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <FaWallet className="text-white text-xs" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
            <div className="text-xs text-white/60">
              {isUsingEnoki ? 'Enoki (zkLogin)' : 'Standard Wallet'}
            </div>
          </div>
          <FaChevronDown className={`text-xs transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown menu */}
        {showDropdown && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-black/90 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl z-50">
            <div className="p-4">
              <div className="text-white text-sm font-medium mb-2">
                {isUsingEnoki ? 'Enoki Address' : 'Wallet Address'}
              </div>
              <div className="flex items-center gap-2 p-2 bg-white/5 rounded border border-white/10">
                <span className="text-white/80 text-xs font-mono flex-1 break-all">
                  {address}
                </span>
                <button
                  onClick={handleCopyAddress}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="Copy address"
                >
                  <FaCopy className="text-white/60 text-xs" />
                </button>
              </div>
              {user?.name && (
                <div className="mt-3">
                  <div className="text-white text-sm font-medium mb-1">Name</div>
                  <div className="text-white/80 text-sm">{user.name}</div>
                </div>
              )}
              {user?.email && (
                <div className="mt-2">
                  <div className="text-white text-sm font-medium mb-1">Email</div>
                  <div className="text-white/80 text-sm">{user.email}</div>
                </div>
              )}
            </div>
            
            <div className="border-t border-white/10">
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 transition-colors text-sm"
              >
                <FaSignOutAlt className="text-sm" />
                {isUsingEnoki ? 'Sign Out' : 'Disconnect Wallet'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full group">
      <button
        onClick={handleGoogleSignIn}
        disabled={isConnecting}
        className="relative w-full group flex items-center justify-center px-6 py-4 text-base font-medium rounded-xl transition-all duration-200 overflow-hidden border disabled:opacity-50 disabled:cursor-not-allowed bg-white hover:bg-gray-50 text-gray-700 border-gray-300 hover:border-gray-400 shadow-sm hover:shadow-md"
      >
        {/* Loading spinner overlay */}
        {isConnecting && (
          <div className="absolute inset-0 bg-white/90 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* Google icon and text */}
        <div className="relative flex items-center justify-center space-x-3">
          {/* Official Google G logo */}
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span className="text-gray-700 font-medium">
            {isConnecting ? 'Signing in...' : 'Continue with Google'}
          </span>
        </div>
      </button>
      
      {/* Alternative: Dark theme version (commented out) */}
      {/* 
      <button
        onClick={handleGoogleSignIn}
        disabled={isConnecting}
        className="relative w-full group flex items-center justify-center px-6 py-4 text-base font-medium rounded-xl transition-all duration-200 overflow-hidden border disabled:opacity-50 disabled:cursor-not-allowed bg-[#1a73e8] hover:bg-[#1557b0] text-white border-[#1a73e8] hover:border-[#1557b0] shadow-sm hover:shadow-md"
      >
        <div className="relative flex items-center justify-center space-x-3">
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span className="text-white font-medium">
            {isConnecting ? 'Signing in...' : 'Continue with Google'}
          </span>
      </div>
      </button>
      */}
    </div>
  );
}; 