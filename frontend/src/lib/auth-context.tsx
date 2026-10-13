/**
 * Auth context — stores JWT token and user info in localStorage.
 * Provides login, logout, and current user across the app.
 */
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, TokenResponse } from '@/types';
import { authApi } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: TokenResponse) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unauthorized = () => { setToken(null); setUser(null); router.replace('/login'); };
    window.addEventListener('grahak:unauthorized', unauthorized);
    return () => window.removeEventListener('grahak:unauthorized', unauthorized);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi.me().then(response => {
      if (!cancelled) { setUser(response.data); localStorage.setItem('grahak_user', JSON.stringify(response.data)); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => {
    const storedToken = localStorage.getItem('grahak_token');
    const storedUser = localStorage.getItem('grahak_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      try { setUser(JSON.parse(storedUser)); } catch { localStorage.removeItem('grahak_user'); localStorage.removeItem('grahak_token'); setToken(null); }
    }
    setIsLoading(false);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const login = (tokenData: TokenResponse) => {
    const userData: User = {
      user_id: tokenData.user_id,
      email: '',
      full_name: tokenData.full_name,
      business_id: tokenData.business_id,
      business_name: '',
      onboarding_completed: tokenData.onboarding_completed,
    };
    localStorage.setItem('grahak_token', tokenData.access_token);
    localStorage.setItem('grahak_user', JSON.stringify(userData));
    setToken(tokenData.access_token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('grahak_token');
    localStorage.removeItem('grahak_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
