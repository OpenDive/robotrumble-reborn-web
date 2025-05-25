import type { ZkLoginInitResponse, ZkLoginCompleteResponse, ZkLoginState } from '../types/zkLogin';

const ZK_STORAGE_KEY = 'zk_login_state';
const SUI_ADDRESS_KEY = 'sui_address';

export async function initZkLogin() {
  try {
    const response = await fetch('/api/zk-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'init' })
    });

    if (!response.ok) {
      throw new Error('Failed to initialize ZK Login');
    }

    const { success, data, error } = await response.json() as ZkLoginInitResponse;
    
    if (!success || !data) {
      throw new Error(error || 'Failed to initialize ZK Login');
    }

    // Store state in localStorage
    localStorage.setItem(ZK_STORAGE_KEY, JSON.stringify(data));
    
    return data;
  } catch (error) {
    console.error('Error initializing ZK Login:', error);
    throw error;
  }
}

export async function completeZkLogin(jwt: string, zkLoginState: ZkLoginState): Promise<string> {
  try {
    console.log('Completing ZK Login with:', {
      jwt: jwt.substring(0, 20) + '...', // Log partial JWT for security
      zkLoginState
    });

    const response = await fetch('/api/zk-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'complete',
        jwt,
        salt: zkLoginState.userSalt,
        extendedEphemeralPublicKey: zkLoginState.extendedEphemeralPublicKey,
        maxEpoch: zkLoginState.maxEpoch,
        randomness: zkLoginState.randomness,
        nonce: zkLoginState.nonce,
        publicKey: zkLoginState.publicKey
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('ZK Login complete error:', errorData);
      throw new Error(errorData.error || 'Failed to complete ZK Login');
    }

    const { success, data, error } = await response.json();
    if (!success || !data) {
      throw new Error(error || 'Failed to complete ZK Login');
    }

    // Store the Sui address
    localStorage.setItem(SUI_ADDRESS_KEY, data.address);
    
    return data.address;
  } catch (error) {
    console.error('Error completing ZK Login:', error);
    throw error;
  }
}

export function getStoredZkState(): Partial<ZkLoginState> | null {
  try {
    const stored = localStorage.getItem(ZK_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error reading ZK state from storage:', error);
    return null;
  }
}

export function getStoredSuiAddress(): string | null {
  try {
    return localStorage.getItem(SUI_ADDRESS_KEY);
  } catch (error) {
    console.error('Error reading Sui address from storage:', error);
    return null;
  }
} 