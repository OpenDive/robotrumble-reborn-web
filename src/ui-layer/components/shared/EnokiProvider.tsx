import React, { useEffect } from 'react';
import { useSuiClientContext } from '@mysten/dapp-kit';
import { isEnokiNetwork, registerEnokiWallets } from '@mysten/enoki';

// You'll need to get these from the Enoki Portal
const ENOKI_API_KEY = import.meta.env.VITE_ENOKI_API_KEY || 'your-enoki-api-key';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id';

// Debug: Log the API key (remove this after testing)
console.log('🔑 Enoki API Key loaded:', ENOKI_API_KEY ? 'Yes' : 'No');
console.log('🔑 Google Client ID loaded:', GOOGLE_CLIENT_ID ? 'Yes' : 'No');
console.log('🔑 API Key preview:', ENOKI_API_KEY ? `${ENOKI_API_KEY.substring(0, 8)}...` : 'Not found');

export function EnokiProvider() {
  const { client, network } = useSuiClientContext();

  useEffect(() => {
    console.log('🔍 EnokiProvider useEffect triggered');
    console.log('🔍 Current network:', network);
    console.log('🔍 isEnokiNetwork check:', isEnokiNetwork(network));
    
    // Force registration for testnet and mainnet (skip the isEnokiNetwork check for now)
    if (network !== 'testnet' && network !== 'mainnet') {
      console.log('🔍 Network not supported by Enoki:', network);
      return;
    }

    console.log('🔐 Registering Enoki wallets for network:', network);
    console.log('🔐 Using API Key:', ENOKI_API_KEY ? `${ENOKI_API_KEY.substring(0, 8)}...` : 'MISSING');
    console.log('🔐 Using Google Client ID:', GOOGLE_CLIENT_ID ? `${GOOGLE_CLIENT_ID.substring(0, 8)}...` : 'MISSING');

    if (!ENOKI_API_KEY || ENOKI_API_KEY === 'your-enoki-api-key') {
      console.error('❌ ENOKI_API_KEY is missing or not set properly');
      return;
    }

    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'your-google-client-id') {
      console.error('❌ GOOGLE_CLIENT_ID is missing or not set properly');
      return;
    }

    try {
      const { unregister } = registerEnokiWallets({
        apiKey: ENOKI_API_KEY,
        providers: {
          google: {
            clientId: GOOGLE_CLIENT_ID,
          },
        },
        client: client as any, // Type assertion to handle version compatibility
        network,
      });

      console.log('✅ Enoki wallets registered successfully');
      return unregister;
    } catch (error) {
      console.error('❌ Failed to register Enoki wallets:', error);
      console.error('❌ Error details:', {
        apiKey: ENOKI_API_KEY ? 'Present' : 'Missing',
        clientId: GOOGLE_CLIENT_ID ? 'Present' : 'Missing',
        network,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }, [client, network]);

  return null;
} 