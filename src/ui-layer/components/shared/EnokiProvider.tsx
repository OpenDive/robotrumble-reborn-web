import React from 'react';
import { EnokiFlowProvider } from '@mysten/enoki/react';

// You'll need to get these from the Enoki Portal
const ENOKI_API_KEY = import.meta.env.VITE_ENOKI_API_KEY || 'your-enoki-api-key';

// Debug: Log the API key (remove this after testing)
console.log('🔑 Enoki API Key loaded:', ENOKI_API_KEY ? 'Yes' : 'No');
console.log('🔑 API Key preview:', ENOKI_API_KEY ? `${ENOKI_API_KEY.substring(0, 8)}...` : 'Not found');

interface EnokiProviderProps {
  children: React.ReactNode;
}

export function EnokiProvider({ children }: EnokiProviderProps) {
  if (!ENOKI_API_KEY || ENOKI_API_KEY === 'your-enoki-api-key') {
    console.error('❌ ENOKI_API_KEY is missing or not set properly');
    return <>{children}</>;
  }

  console.log('✅ Enoki Flow Provider initialized');
  
  return (
    <EnokiFlowProvider apiKey={ENOKI_API_KEY}>
      {children}
    </EnokiFlowProvider>
  );
} 