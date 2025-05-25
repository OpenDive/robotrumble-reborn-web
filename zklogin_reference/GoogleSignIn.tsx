'use client'

import { useAuth } from '@/contexts/AuthContext';
import { JwtPayload, jwtDecode } from "jwt-decode";
import { useEffect } from "react";
import { initZkLogin, completeZkLogin } from '@/utils/zkLogin';

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

interface GoogleJwtPayload extends JwtPayload {
  email?: string;
  name?: string;
  picture?: string;
}

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  console.log('Starting token exchange...');
  console.log('Using redirect URI:', redirectUri);
  console.log('Using client ID:', process.env.NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_ID);
  
  const tokenEndpoint = 'https://oauth2.googleapis.com/token';
  const params = new URLSearchParams({
    code,
    client_id: process.env.NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_ID!,
    client_secret: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET!,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  
  console.log('Request params:', params.toString());
  
  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const responseText = await response.text();
    console.log('Raw response:', responseText);

    if (!response.ok) {
      console.error('Token exchange error:', responseText);
      throw new Error('Failed to exchange code for tokens');
    }

    return JSON.parse(responseText);
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

export default function GoogleSignIn() {
  const { user, setUser } = useAuth();

  // Debug effect to monitor user state changes
  useEffect(() => {
    console.log('User state changed:', user);
  }, [user]);

  const handleSignOut = async () => {
    try {
      if (user?.accessToken) {
        // Revoke the token
        await fetch(`https://oauth2.googleapis.com/revoke?token=${user.accessToken}`, {
          method: 'POST',
        });
      }
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      setUser(null);
    }
  };

  const handleSignIn = async () => {
    try {
      // Initialize ZK Login first
      const zkState = await initZkLogin();
      console.log('ZK State:', zkState);

      // Dynamically import Tauri APIs
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      const port = await invoke<number>("start_server");
      const redirectUri = `http://localhost:${port}`;
      
      const authEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
      const params = new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'email profile openid',
        state: Math.random().toString(36).substring(2, 15),
        nonce: Math.random().toString(36).substring(2, 15),
      });

      // Listen for the OAuth callback
      const unlisten = await listen<string>('redirect_uri', async (event) => {
        try {
          console.log('Received redirect:', event.payload);
          const url = new URL(event.payload);
          const code = url.searchParams.get('code');
          console.log('Auth code:', code);
          if (code) {
            const tokens = await exchangeCodeForTokens(code, redirectUri);
            const userData = jwtDecode<GoogleJwtPayload>(tokens.id_token);
            
            // Complete ZK Login with JWT
            const suiAddress = await completeZkLogin(tokens.id_token, zkState);
            console.log('SUI Address:', suiAddress);
            
            const newUser = {
              accessToken: tokens.access_token,
              idToken: tokens.id_token,
              email: userData.email,
              name: userData.name,
              suiAddress,
              zkLoginState: zkState
            };
            setUser(newUser);
          }
          unlisten();
        } catch (error) {
          console.error('Error handling OAuth response:', error);
          setUser(null);
        }
      });

      await invoke('open_url', { url: `${authEndpoint}?${params.toString()}` });
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  return (
    <div>
      {user ? (
        <button
          onClick={handleSignOut}
          className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
        >
          Sign Out
        </button>
      ) : (
        <button
          onClick={handleSignIn}
          className="w-full flex items-center justify-center gap-2 bg-white border-2 border-black/10 hover:border-black/20 text-black py-3 px-4 rounded-xl font-medium transition-colors mb-6"
        >
          <GoogleIcon />
          Continue with ZK Login
        </button>
      )}
    </div>
  );
} 