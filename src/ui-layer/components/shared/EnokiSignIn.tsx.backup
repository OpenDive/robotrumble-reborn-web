import React from 'react';
import { useConnectWallet, useCurrentAccount, useWallets } from '@mysten/dapp-kit';
import { isEnokiWallet, type EnokiWallet, type AuthProvider } from '@mysten/enoki';
import { useAuth } from '../../../shared/contexts/AuthContext';

const GoogleIcon = () => (
  <svg 
    viewBox="0 0 24 24" 
    width="20" 
    height="20" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export default function EnokiSignIn() {
  const { setUser } = useAuth();
  const currentAccount = useCurrentAccount();
  const { mutate: connectWallet, error: connectError, isPending } = useConnectWallet();
  const [hasSetUser, setHasSetUser] = React.useState(false);

  // Filter for Enoki wallets only
  const wallets = useWallets().filter(isEnokiWallet);
  const walletsByProvider = wallets.reduce(
    (map, wallet) => map.set(wallet.provider, wallet),
    new Map<AuthProvider, EnokiWallet>(),
  );

  const googleWallet = walletsByProvider.get('google');

  // Handle successful connection - prevent infinite loops
  React.useEffect(() => {
    if (currentAccount && !hasSetUser) {
      console.log('✅ Enoki wallet connected:', currentAccount.address);
      
      // Update auth context with Enoki user
      setUser({
        suiAddress: currentAccount.address,
        loginMethod: 'google' as const,
        // Note: Enoki handles all the zkLogin complexity internally
        // No need to manage JWT, salt, or ephemeral keys manually
      });
      
      setHasSetUser(true);
    } else if (!currentAccount && hasSetUser) {
      // Reset flag if user disconnects
      setHasSetUser(false);
    }
  }, [currentAccount, setUser, hasSetUser]);

  // Handle connection errors
  React.useEffect(() => {
    if (connectError) {
      console.error('❌ Connection error:', connectError);
    }
  }, [connectError]);

  const handleSignIn = async () => {
    if (!googleWallet) {
      console.error('❌ Google wallet not available');
      return;
    }

    try {
      console.log('🔐 Connecting with Enoki Google wallet...');
      console.log('🔐 Wallet details:', {
        name: googleWallet.name,
        provider: googleWallet.provider,
        features: googleWallet.features
      });
      
      connectWallet({ wallet: googleWallet });
    } catch (error) {
      console.error('❌ Failed to connect with Enoki:', error);
    }
  };

  const handleSignOut = () => {
    setUser(null);
    setHasSetUser(false);
    // Note: Enoki wallets handle disconnection automatically
  };

  if (currentAccount) {
    return (
      <div className="flex flex-col items-center space-y-4">
        <div className="text-center">
          <p className="text-white/70 mb-2">Connected with Enoki</p>
          <p className="text-sm font-mono text-white/90 break-all">
            {currentAccount.address}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {googleWallet ? (
        <button
          onClick={handleSignIn}
          disabled={isPending}
          className="flex items-center space-x-3 px-6 py-3 bg-white hover:bg-gray-50 text-gray-900 rounded-lg font-medium transition-colors shadow-lg disabled:opacity-50"
        >
          <GoogleIcon />
          <span>{isPending ? 'Connecting...' : 'Sign in with Google (Enoki)'}</span>
        </button>
      ) : (
        <div className="text-center">
          <p className="text-white/70 mb-2">Enoki wallet not available</p>
          <p className="text-sm text-white/50">
            Available wallets: {wallets.length}
          </p>
          {connectError && (
            <p className="text-sm text-red-400 mt-2">
              Error: {connectError.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
} 