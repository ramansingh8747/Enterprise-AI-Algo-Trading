import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { UserResponse, LoginRequest } from '@/types/auth';
import { authApi } from '@/services/api/authApi';
import { usersApi, UserUpdateRequest, ChangePasswordRequest } from '@/services/api/usersApi';
import {
  clearLegacySharedSession,
  clearSession,
  getActiveSessionScope,
  getSessionToken,
  getSessionUser,
  getSessionScopeForRole,
  saveSession,
  setActiveSessionScope,
  updateSessionUser,
} from '@/services/auth/session';

interface AuthContextType {
  user: UserResponse | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<UserResponse>;
  verifyOtp?: (phone_number: string, otp_code: string, login_type?: 'trader' | 'admin') => Promise<UserResponse>;
  logout: () => void;
  updateProfile: (data: UserUpdateRequest) => Promise<UserResponse>;
  changePassword: (data: ChangePasswordRequest) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  let currentPath = '';
  try {
    const loc = useLocation();
    currentPath = loc.pathname;
  } catch {
    currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  }

  useEffect(() => {
    const syncAuthForRoute = async () => {
      clearLegacySharedSession();

      const scope = (currentPath.startsWith('/admin') || currentPath.startsWith('/kill-switch')) ? 'admin' : 'trader';
      const token = getSessionToken(scope);
      const storedUser = getSessionUser(scope);

      if (!token || !storedUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      setActiveSessionScope(scope);
      setUser(storedUser);

      try {
        const userData = await authApi.getMe();
        const expectedScope = getSessionScopeForRole(userData.role);

        // Never allow a role change to silently reuse the wrong session bucket.
        if (expectedScope !== scope) {
          clearSession(scope);
          setUser(null);
        } else {
          setUser(userData);
          updateSessionUser(scope, userData);
        }
      } catch (err: any) {
        const status = err?.status || err?.response?.status;
        if (status === 401 || status === 403) {
          clearSession(scope);
          setUser(null);
        } else {
          console.warn('Backend server temporarily unavailable or network issue during auth sync:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    void syncAuthForRoute();
  }, [currentPath]);

  const login = async (credentials: LoginRequest): Promise<UserResponse> => {
    setLoading(true);
    try {
      const response = await authApi.login(credentials);
      const scope = getSessionScopeForRole(response.user.role);
      saveSession(scope, response.access_token, response.refresh_token, response.user);
      setUser(response.user);
      return response.user;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (phone_number: string, otp_code: string, login_type?: 'trader' | 'admin'): Promise<UserResponse> => {
    setLoading(true);
    try {
      const response = await authApi.verifyOtp({ phone_number, otp_code, login_type });
      const scope = getSessionScopeForRole(response.user.role);
      saveSession(scope, response.access_token, response.refresh_token, response.user);
      setUser(response.user);
      return response.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    const scope = getActiveSessionScope();
    if (scope) {
      clearSession(scope);
    }
    setUser(null);
  };

  const updateProfile = async (data: UserUpdateRequest): Promise<UserResponse> => {
    const updatedUser = await usersApi.updateMe(data);
    setUser(updatedUser);
    const scope = getActiveSessionScope();
    if (scope) updateSessionUser(scope, updatedUser);
    return updatedUser;
  };

  const changePassword = async (data: ChangePasswordRequest): Promise<void> => {
    await usersApi.changePassword(data);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        verifyOtp,
        logout,
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
