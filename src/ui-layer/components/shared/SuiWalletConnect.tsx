import React, { useState } from 'react';
import { useCurrentAccount, useConnectWallet, useDisconnectWallet, useWallets, ConnectButton } from '@mysten/dapp-kit';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { FaWallet, FaChevronDown, FaCopy, FaSignOutAlt, FaTrash, FaWrench } from 'react-icons/fa';

export default function SuiWalletConnect() {
  const { user, setUser, logout } = useAuth();
  const currentAccount = useCurrentAccount();
  const { mutate: connectWallet } = useConnectWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const wallets = useWallets();
  const [showDropdown, setShowDropdown] = useState(false);

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
    console.log('handleDisconnect called');
    console.log('user:', user);
    console.log('user?.loginMethod:', user?.loginMethod);
    
    // Handle both wallet and ZkLogin disconnection
    if (user?.loginMethod === 'google') {
      // Clear ZkLogin data
      console.log('Disconnecting ZkLogin user...');
      logout();
      setShowDropdown(false);
      console.log('ZkLogin user disconnected');
      return;
    }
    
    // Clear any stored wallet connection data
    try {
      // Clear dApp Kit storage
      localStorage.removeItem('sui-dapp-kit:wallet-connection-info');
      localStorage.removeItem('sui-dapp-kit:last-connected-wallet-name');
      localStorage.removeItem('sui-dapp-kit:wallet-connection-status');
      
      // Clear any other wallet-related storage
      Object.keys(localStorage).forEach(key => {
        if (key.includes('wallet') || key.includes('sui') || key.includes('dapp')) {
          localStorage.removeItem(key);
        }
      });
      
      console.log('Cleared wallet storage');
    } catch (error) {
      console.error('Error clearing wallet storage:', error);
    }
    
    disconnectWallet();
    setShowDropdown(false);
  };

  const handleCopyAddress = () => {
    const address = currentAccount?.address || user?.suiAddress;
    if (address) {
      navigator.clipboard.writeText(address);
      // You could add a toast notification here
      console.log('Address copied to clipboard');
    }
  };

  const handleFixCorruptedZkLogin = () => {
    // With Enoki, we just sign out and sign back in
    logout();
    console.log('🔧 Enoki session cleared (keeping same address)');
    setShowDropdown(false);
  };

  const handleClearZkLogin = () => {
    // With Enoki, we clear local storage and sign out
    localStorage.clear();
    logout();
    console.log('🧹 All Enoki data cleared (will generate new address)');
    setShowDropdown(false);
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
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

  // Check if user is connected via wallet or ZkLogin
  const isConnected = currentAccount || user;
  const displayAddress = currentAccount?.address || user?.suiAddress;
  const displayName = currentAccount?.label || user?.name || 'User';

  if (isConnected && displayAddress) {
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
              {displayAddress.slice(0, 6)}...{displayAddress.slice(-4)}
            </div>
            {user?.loginMethod === 'google' && (
              <div className="text-xs text-white/60">ZkLogin</div>
            )}
          </div>
          <FaChevronDown className={`text-xs transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown menu */}
        {showDropdown && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-black/90 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl z-50">
            <div className="p-4">
              <div className="text-white text-sm font-medium mb-2">
                {user?.loginMethod === 'google' ? 'ZkLogin Address' : 'Wallet Address'}
              </div>
              <div className="flex items-center gap-2 p-2 bg-white/5 rounded border border-white/10">
                <span className="text-white/80 text-xs font-mono flex-1 break-all">
                  {displayAddress}
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
              {user?.loginMethod === 'google' && (
                <>
                  <button
                    onClick={handleFixCorruptedZkLogin}
                    className="w-full flex items-center gap-3 px-4 py-3 text-blue-400 hover:bg-blue-500/10 transition-colors text-sm border-b border-white/10"
                  >
                    <FaWrench className="text-sm" />
                    Fix Corrupted Data (Keep Address)
                  </button>
                  <button
                    onClick={handleClearZkLogin}
                    className="w-full flex items-center gap-3 px-4 py-3 text-yellow-400 hover:bg-yellow-500/10 transition-colors text-sm border-b border-white/10"
                  >
                    <FaTrash className="text-sm" />
                    Clear All Data (New Address)
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  console.log('Disconnect button clicked');
                  handleDisconnect();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 transition-colors text-sm"
              >
                <FaSignOutAlt className="text-sm" />
                {user?.loginMethod === 'google' ? 'Sign Out' : 'Disconnect Wallet'}
              </button>
            </div>
          </div>
        )}
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