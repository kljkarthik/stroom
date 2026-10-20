import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, OnboardingStatus } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, fullName: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUserStatus: (status: OnboardingStatus) => void;
  loginAsDemoUser: (type: 'newUser' | 'admin' | 'completedUser') => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('stroom_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const { user } = await api.getMe();
        setUser(user);
      } catch (err) {
        console.error('Failed to restore session:', err);
        localStorage.removeItem('stroom_token');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, [token]);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.login({ email, password });
      localStorage.setItem('stroom_token', res.token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, fullName: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.register({ email, password, full_name: fullName });
      localStorage.setItem('stroom_token', res.token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('stroom_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const { user } = await api.getMe();
      setUser(user);
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const updateUserStatus = (status: OnboardingStatus) => {
    if (user) {
      setUser({ ...user, onboarding_status: status });
    }
  };

  const loginAsDemoUser = async (type: 'newUser' | 'admin' | 'completedUser'): Promise<User> => {
    setIsLoading(true);
    try {
      if (type === 'admin') {
        return await login('admin@stroom.app', 'Admin@123');
      } else {
        const u = await login('user@stroom.app', 'User@123');
        if (type === 'newUser') {
          // Reset to fresh NOT_STARTED
          const resetRes = await api.resetDemo('NOT_STARTED');
          setUser(resetRes.user);
          return resetRes.user;
        } else if (type === 'completedUser') {
          const resetRes = await api.resetDemo('COMPLETED');
          setUser(resetRes.user);
          return resetRes.user;
        }
        return u;
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout,
        refreshUser,
        updateUserStatus,
        loginAsDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
