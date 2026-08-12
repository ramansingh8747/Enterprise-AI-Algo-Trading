import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserResponse, LoginRequest } from '@/types/auth';
import { authApi } from '@/services/api/authApi';
import { usersApi, UserUpdateRequest, ChangePasswordRequest } from '@/services/api/usersApi';

interface AuthContextType {
  user: UserResponse | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  updateProfile: (data: UserUpdateRequest) => Promise<UserResponse>;
  changePassword: (data: ChangePasswordRequest) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user_profile');

      if (token) {
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch (err) {
            console.warn('Invalid stored user profile', err);
          }
        }

        try {
          const userData = await authApi.getMe();
          setUser(userData);
          localStorage.setItem('user_profile', JSON.stringify(userData));
        } catch {
          // Clear authentication state if session is invalid or expired
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_profile');
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    setLoading(true);
    try {
      const response = await authApi.login(credentials);
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
      localStorage.setItem('user_profile', JSON.stringify(response.user));
      setUser(response.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_profile');
    setUser(null);
  };

  const updateProfile = async (data: UserUpdateRequest): Promise<UserResponse> => {
    const updatedUser = await usersApi.updateMe(data);
    setUser(updatedUser);
    localStorage.setItem('user_profile', JSON.stringify(updatedUser));
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
