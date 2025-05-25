import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  zkLoginState?: ZkLoginState;
  walletAddress?: string;
  loginMethod: 'google' | 'wallet';
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
        
        if (storedUser && storedSuiAddress) {
          const userData = JSON.parse(storedUser);
          setUser({ ...userData, suiAddress: storedSuiAddress });
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
    localStorage.removeItem('zk_login_state');
    
    console.log('User state cleared');
  };

  const handleSetUser = (newUser: User | null) => {
    setUser(newUser);
    if (newUser) {
      // Store user data (excluding sensitive tokens in production)
      const userToStore = {
        email: newUser.email,
        name: newUser.name,
        picture: newUser.picture,
        zkLoginState: newUser.zkLoginState,
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