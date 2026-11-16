import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, OnboardingStatus, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPartner: boolean;
  isCheckinStaff: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, fullName: string) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUserStatus: (status: OnboardingStatus) => void;
  switchUserRole: (role: UserRole) => Promise<void>;
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
    if (token) {
      api.logout().catch(() => {});
    }
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

  const switchUserRole = async (newRole: UserRole) => {
    if (!user) return;
    await api.updateMemberRole(user.id, newRole);
    setUser({ ...user, role: newRole });
  };

  const adminStaffRoles = [
    'admin',
    'super_admin',
    'platform_admin',
    'event_manager',
    'community_manager',
    'partner_manager',
    'checkin_staff',
    'support_staff',
  ];
  const isAdminRole = !!user?.role && adminStaffRoles.includes(user.role);
  const isSuperAdminRole = user?.role === 'super_admin';
  const isPartnerRole = user?.role === 'venue_partner' || user?.role === 'partner_manager' || user?.role === 'admin' || isSuperAdminRole;
  const isCheckinStaffRole = user?.role === 'checkin_staff' || user?.role === 'event_manager' || user?.role === 'admin' || isSuperAdminRole;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: isAdminRole,
        isSuperAdmin: isSuperAdminRole,
        isPartner: isPartnerRole,
        isCheckinStaff: isCheckinStaffRole,
        login,
        register,
        logout,
        refreshUser,
        updateUserStatus,
        switchUserRole,
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
