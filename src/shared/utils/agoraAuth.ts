// Agora authentication utilities
export const APP_ID = import.meta.env.VITE_AGORA_APP_ID || '598a5efd867842b98ece817df8be08ee';

// Token management
let currentToken: string | null = null;
const tokenExpiryTime = 3600; // Token expiry in seconds (1 hour)
let tokenExpiryTimer: NodeJS.Timeout | null = null;

// Token server URL - use local dev server in development, Vercel API in production
const TOKEN_SERVER_URL = import.meta.env.DEV 
  ? 'http://localhost:3001/api/token'
  : '/api/token';

/**
 * Fetch a token from the token server
 * @param channelName - Name of the channel to get token for
 * @param uid - User ID
 * @param role - User role ('host' or 'audience')
 * @returns Promise<string> The token
 */
export async function fetchToken(
  channelName: string, 
  uid: number | string, 
  role: 'host' | 'audience'
): Promise<string> {
  try {
    console.log(`Requesting token from server for channel: ${channelName}, uid: ${uid}, role: ${role}`);
    
    // Try to fetch from token server
    const response = await fetch(
      `${TOKEN_SERVER_URL}?channelName=${encodeURIComponent(channelName)}&uid=${uid}&role=${role}`
    );
    
    if (!response.ok) {
      throw new Error(`Token server error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    if (!data.token) {
      throw new Error('Token not found in response');
    }
    
    currentToken = data.token;
    
    // Set up token refresh before it expires
    const refreshTime = (tokenExpiryTime - 60) * 1000; // Refresh 1 minute before expiry
    if (tokenExpiryTimer) {
      clearTimeout(tokenExpiryTimer);
    }
    
    tokenExpiryTimer = setTimeout(() => {
      console.log('Token about to expire, refreshing...');
      fetchToken(channelName, uid, role)
        .catch(error => console.error(`Error refreshing token: ${error.message}`));
    }, refreshTime);
    
    console.log('Successfully obtained token from server');
    return data.token;
    
  } catch (error) {
    console.error(`Error fetching token: ${error instanceof Error ? error.message : error}`);
    throw error; // Re-throw instead of falling back to temp token
  }
}

/**
 * Get the current token
 * @returns The current token or null if not set
 */
export function getCurrentToken(): string | null {
  return currentToken;
}

/**
 * Clear the current token and stop the expiry timer
 */
export function clearToken(): void {
  currentToken = null;
  if (tokenExpiryTimer) {
    clearTimeout(tokenExpiryTimer);
    tokenExpiryTimer = null;
  }
} 