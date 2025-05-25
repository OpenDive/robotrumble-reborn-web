import React, { useEffect } from 'react';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { jwtDecode, JwtPayload } from 'jwt-decode';
import { initZkLogin, completeZkLogin } from '../../../shared/utils/zkLogin';
import { FaGoogle } from 'react-icons/fa';

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

// Google OAuth configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id';
const REDIRECT_URI = window.location.origin + '/auth/callback';

async function exchangeCodeForTokens(code: string) {
  console.log('Starting token exchange...');
  
  const tokenEndpoint = 'https://oauth2.googleapis.com/token';
  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  
  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const responseText = await response.text();
    console.log('Token exchange response:', responseText);

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

  // Handle OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        return;
      }

      if (code) {
        try {
          console.log('Processing OAuth callback with code:', code);
          
          // Initialize ZK Login first
          const zkState = await initZkLogin();
          console.log('ZK State:', zkState);

          // Exchange code for tokens
          const tokens = await exchangeCodeForTokens(code);
          const userData = jwtDecode<GoogleJwtPayload>(tokens.id_token);
          
          // Complete ZK Login with JWT
          const suiAddress = await completeZkLogin(tokens.id_token, zkState);
          console.log('SUI Address:', suiAddress);
          
          const newUser = {
            accessToken: tokens.access_token,
            idToken: tokens.id_token,
            email: userData.email,
            name: userData.name,
            picture: userData.picture,
            suiAddress,
            zkLoginState: zkState,
            loginMethod: 'google' as const
          };
          
          setUser(newUser);
          
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('Error handling OAuth response:', error);
        }
      }
    };

    handleOAuthCallback();
  }, [setUser]);

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
      // Initialize ZK Login first to get the nonce
      const zkState = await initZkLogin();
      console.log('ZK State:', zkState);

      const authEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'email profile openid',
        state: Math.random().toString(36).substring(2, 15),
        nonce: zkState.nonce, // Use the nonce from ZK Login
      });

      // Redirect to Google OAuth
      window.location.href = `${authEndpoint}?${params.toString()}`;
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {user.picture && (
            <img 
              src={user.picture} 
              alt="Profile" 
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-white">{user.name || user.email}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      className="relative w-full group flex items-center justify-center px-6 py-4 text-lg font-bold rounded-xl text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm transition-all duration-300 overflow-hidden"
    >
      {/* Animated background gradient */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-neon-purple/20 via-white/5 to-neon-purple/20"
        style={{
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s linear infinite',
        }}
      />
      <div className="relative flex items-center gap-4 w-full">
        <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-5deg]">
          <GoogleIcon />
        </div>
        <span className="flex-1 text-left transition-transform duration-300 group-hover:translate-x-1">Login with Google</span>
        <div className="w-2 h-8 rounded-full bg-neon-purple scale-y-0 group-hover:scale-y-100 transition-transform duration-300" />
      </div>
    </button>
  );
} 