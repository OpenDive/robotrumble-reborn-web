import React, { useState } from 'react';
import { useCurrentAccount, useConnectWallet, useDisconnectWallet, useWallets, ConnectButton } from '@mysten/dapp-kit';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { FaWallet, FaChevronDown, FaCopy, FaSignOutAlt } from 'react-icons/fa';

export default function SuiWalletConnect() {
  const { user, setUser } = useAuth();
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
    if (currentAccount?.address) {
      navigator.clipboard.writeText(currentAccount.address);
      // You could add a toast notification here
      console.log('Address copied to clipboard');
    }
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

  if (currentAccount) {
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
              {currentAccount.address.slice(0, 6)}...{currentAccount.address.slice(-4)}
            </div>
          </div>
          <FaChevronDown className={`text-xs transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown menu */}
        {showDropdown && (
          <div className="absolute top-full right-0 mt-2 w-64 bg-black/90 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl z-50">
            <div className="p-4">
              <div className="text-white text-sm font-medium mb-2">Wallet Address</div>
              <div className="flex items-center gap-2 p-2 bg-white/5 rounded border border-white/10">
                <span className="text-white/80 text-xs font-mono flex-1 break-all">
                  {currentAccount.address}
                </span>
                <button
                  onClick={handleCopyAddress}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  title="Copy address"
                >
                  <FaCopy className="text-white/60 text-xs" />
                </button>
              </div>
            </div>
            
            <div className="border-t border-white/10">
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 transition-colors text-sm"
              >
                <FaSignOutAlt className="text-sm" />
                Disconnect Wallet
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