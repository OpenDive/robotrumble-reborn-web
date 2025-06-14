import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Legacy interface for backward compatibility - deprecated, use Enoki instead
export interface ZkLoginState {
  publicKey: string;
  randomness: string;
  nonce: string;
  maxEpoch: number;
  userSalt: string;
  extendedEphemeralPublicKey: string;
}

export interface User {
  accessToken?: string;
  idToken?: string;
  email?: string;
  name?: string;
  picture?: string;
  suiAddress: string;
  zkLoginState?: ZkLoginState; // Legacy field - deprecated, use Enoki instead
  walletAddress?: string;
  loginMethod: 'google' | 'wallet' | 'enoki';
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored user data on app load
    const checkStoredAuth = () => {
      try {
        const storedUser = localStorage.getItem('auth_user');
        const storedSuiAddress = localStorage.getItem('sui_address');
        
        console.log('🔍 AuthContext: Checking stored auth data...');
        console.log('🔍 Stored user:', storedUser);
        console.log('🔍 Stored SUI address:', storedSuiAddress);
        
        if (storedUser && storedSuiAddress) {
          const userData = JSON.parse(storedUser);
          console.log('🔍 Parsed user data:', userData);
          console.log('⚠️ Found stored auth data - this might be causing automatic navigation');
          console.log('⚠️ Clearing stored auth data to prevent automatic login');
          
          // Clear the stored data instead of loading it
          localStorage.removeItem('auth_user');
          localStorage.removeItem('sui_address');
          
          // Don't set the user - let them authenticate fresh
          // setUser({ ...userData, suiAddress: storedSuiAddress });
        } else {
          console.log('✅ No stored auth data found');
        }
      } catch (error) {
        console.error('Error loading stored auth:', error);
        // Clear invalid stored data
        localStorage.removeItem('auth_user');
        localStorage.removeItem('sui_address');
      } finally {
        setIsLoading(false);
      }
    };

    checkStoredAuth();
  }, []);

  const logout = () => {
    console.log('Logout function called');
    
    // Clear user state and localStorage
    setUser(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('sui_address');
    localStorage.removeItem('zk_login_state'); // Legacy zkLogin
    
    // Clear Enoki-related data
    Object.keys(localStorage).forEach(key => {
      if (key.includes('enoki') || key.includes('wallet') || key.includes('sui')) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('User state and all authentication data cleared');
  };

  const handleSetUser = (newUser: User | null) => {
    setUser(newUser);
    if (newUser) {
      // Store user data (including tokens for authentication)
      const userToStore = {
        email: newUser.email,
        name: newUser.name,
        picture: newUser.picture,
        idToken: newUser.idToken, // Store idToken for authentication
        zkLoginState: newUser.zkLoginState, // Legacy field
        walletAddress: newUser.walletAddress,
        loginMethod: newUser.loginMethod
      };
      localStorage.setItem('auth_user', JSON.stringify(userToStore));
      localStorage.setItem('sui_address', newUser.suiAddress);
    }
  };

  const value: AuthContextType = {
    user,
    setUser: handleSetUser,
    isLoading,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 