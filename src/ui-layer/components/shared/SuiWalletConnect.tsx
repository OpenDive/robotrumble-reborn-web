import React from 'react';
import { useCurrentAccount, useConnectWallet, useDisconnectWallet, useWallets, ConnectButton } from '@mysten/dapp-kit';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { FaWallet } from 'react-icons/fa';

export default function SuiWalletConnect() {
  const { user, setUser } = useAuth();
  const currentAccount = useCurrentAccount();
  const { mutate: connectWallet } = useConnectWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const wallets = useWallets();

  // Update auth context when wallet connection changes
  React.useEffect(() => {
    if (currentAccount && !user) {
      // User connected wallet
      const newUser = {
        suiAddress: currentAccount.address,
        walletAddress: currentAccount.address,
        loginMethod: 'wallet' as const,
        name: currentAccount.label || 'Wallet User'
      };
      setUser(newUser);
    } else if (!currentAccount && user?.loginMethod === 'wallet') {
      // User disconnected wallet
      setUser(null);
    }
  }, [currentAccount, user, setUser]);

  const handleDisconnect = () => {
    disconnectWallet();
  };

  if (currentAccount) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <FaWallet className="text-white text-sm" />
          </div>
          <div className="text-white">
            <div className="text-sm font-medium">{currentAccount.label || 'Wallet'}</div>
            <div className="text-xs text-white/60">
              {currentAccount.address.slice(0, 6)}...{currentAccount.address.slice(-4)}
            </div>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full group">
      <ConnectButton
        connectText="Connect Wallet"
        className="relative w-full group flex items-center justify-center px-6 py-4 text-lg font-bold rounded-xl text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-all duration-300 overflow-hidden"
      />
      {/* Custom styling overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-neon-purple/20 via-white/5 to-neon-purple/20 rounded-xl"
          style={{
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s linear infinite',
          }}
        />
      </div>
    </div>
  );
} 