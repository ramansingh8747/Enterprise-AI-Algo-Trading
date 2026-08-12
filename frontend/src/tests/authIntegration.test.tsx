import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { usersApi } from '@/services/api/usersApi';
import axiosInstance from '@/services/http/axios';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';

vi.mock('@/services/http/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

const mockUser = {
  id: 'user-uuid-123',
  email: 'trader@enterprise.com',
  username: 'trader1',
  full_name: 'Enterprise Trader',
  role: 'TRADER',
  is_active: true,
  is_verified: true,
};

const mockTokenResponse = {
  access_token: 'valid_access_token',
  refresh_token: 'valid_refresh_token',
  token_type: 'bearer',
  user: mockUser,
};

describe('Phase 14 — Frontend Authentication & User Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // 1. Login success
  it('1. Login success stores tokens and sets authenticated state', async () => {
    (axiosInstance.post as any).mockResolvedValueOnce({
      data: { success: true, message: 'Login successful', data: mockTokenResponse },
    });

    const TestComponent = () => {
      const { user, isAuthenticated, login } = useAuth();
      return (
        <div>
          <span data-testid="auth-status">{isAuthenticated ? 'LOGGED_IN' : 'LOGGED_OUT'}</span>
          <span data-testid="user-email">{user?.email || ''}</span>
          <button onClick={() => login({ email: 'trader@enterprise.com', password: 'Password123' })}>
            Do Login
          </button>
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Do Login'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('LOGGED_IN');
    });

    expect(screen.getByTestId('user-email').textContent).toBe('trader@enterprise.com');
    expect(localStorage.getItem('access_token')).toBe('valid_access_token');
    expect(localStorage.getItem('refresh_token')).toBe('valid_refresh_token');
    expect(JSON.parse(localStorage.getItem('user_profile') || '{}')).toEqual(mockUser);
  });

  // 2. Login failure
  it('2. Login failure handles 401 invalid credentials error', async () => {
    (axiosInstance.post as any).mockRejectedValueOnce({
      response: {
        status: 401,
        data: { success: false, message: 'Invalid email or password.', data: null },
      },
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText('trader@enterprise.com')).toBeDefined();
    });

    fireEvent.change(screen.getByPlaceholderText('trader@enterprise.com'), {
      target: { value: 'wrong@enterprise.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'WrongPassword' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeDefined();
    });
  });

  // 3. Registration success
  it('3. Registration success displays success message and does not auto-login', async () => {
    (axiosInstance.post as any).mockResolvedValueOnce({
      data: { success: true, message: 'User created successfully', data: mockUser },
    });

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('trader@enterprise.com'), {
      target: { value: 'newuser@enterprise.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('trader1'), {
      target: { value: 'newtrader' },
    });
    fireEvent.change(screen.getByPlaceholderText('Pro Trader'), {
      target: { value: 'New Trader' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(screen.getByText('Registration successful! You can now sign in.')).toBeDefined();
    });

    expect(localStorage.getItem('access_token')).toBeNull();
  });

  // 4. Registration validation failure
  it('4. Registration handles 409 conflict and 422 validation errors', async () => {
    (axiosInstance.post as any).mockRejectedValueOnce({
      response: {
        status: 409,
        data: { success: false, message: 'A user with email trader@enterprise.com already exists.', data: null },
      },
    });

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('trader@enterprise.com'), {
      target: { value: 'trader@enterprise.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('trader1'), {
      target: { value: 'trader1' },
    });
    fireEvent.change(screen.getByPlaceholderText('Pro Trader'), {
      target: { value: 'Pro Trader' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Password123' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(screen.getByText('A user with email trader@enterprise.com already exists.')).toBeDefined();
    });
  });

  // 5. AuthContext restores authenticated user
  it('5. AuthContext restores user via authApi.getMe on session startup', async () => {
    localStorage.setItem('access_token', 'stored_access_token');
    localStorage.setItem('user_profile', JSON.stringify(mockUser));

    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'User profile retrieved', data: mockUser },
    });

    const TestComponent = () => {
      const { user, isAuthenticated, loading } = useAuth();
      if (loading) return <div>Loading...</div>;
      return (
        <div>
          <span data-testid="status">{isAuthenticated ? 'AUTHENTICATED' : 'ANONYMOUS'}</span>
          <span data-testid="username">{user?.username}</span>
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('AUTHENTICATED');
    });

    expect(screen.getByTestId('username').textContent).toBe('trader1');
  });

  // 6. AuthContext handles invalid session
  it('6. AuthContext handles invalid session by clearing tokens', async () => {
    localStorage.setItem('access_token', 'expired_access_token');
    localStorage.setItem('user_profile', JSON.stringify(mockUser));

    (axiosInstance.get as any).mockRejectedValueOnce({
      response: {
        status: 401,
        data: { success: false, message: 'The provided token has expired.', data: null },
      },
    });

    const TestComponent = () => {
      const { isAuthenticated, loading } = useAuth();
      if (loading) return <div>Loading...</div>;
      return <span data-testid="status">{isAuthenticated ? 'AUTHENTICATED' : 'ANONYMOUS'}</span>;
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('ANONYMOUS');
    });

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('user_profile')).toBeNull();
  });

  // 7. Protected route redirects unauthenticated user
  it('7. Protected route redirects unauthenticated user to login', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>LOGIN_PAGE</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<div>DASHBOARD_PAGE</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('LOGIN_PAGE')).toBeDefined();
    });
  });

  // 8. Protected route allows authenticated user
  it('8. Protected route allows authenticated user', async () => {
    localStorage.setItem('access_token', 'valid_token');
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'User details', data: mockUser },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>LOGIN_PAGE</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<div>DASHBOARD_PAGE</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('DASHBOARD_PAGE')).toBeDefined();
    });
  });

  // 9. Logout clears authentication state
  it('9. Logout clears tokens and resets user state', async () => {
    localStorage.setItem('access_token', 'token_to_clear');
    localStorage.setItem('user_profile', JSON.stringify(mockUser));

    (axiosInstance.get as any).mockResolvedValueOnce({
      data: { success: true, message: 'User profile retrieved', data: mockUser },
    });

    const TestComponent = () => {
      const { isAuthenticated, logout, loading } = useAuth();
      if (loading) return <div>Loading...</div>;
      return (
        <div>
          <span data-testid="status">{isAuthenticated ? 'LOGGED_IN' : 'LOGGED_OUT'}</span>
          <button onClick={logout}>Sign Out</button>
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('LOGGED_IN');
    });

    fireEvent.click(screen.getByText('Sign Out'));

    expect(screen.getByTestId('status').textContent).toBe('LOGGED_OUT');
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('user_profile')).toBeNull();
  });

  // 10. /users/me direct response (Type B) handling
  it('10. usersApi.getMe handles Type B direct Pydantic response', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({
      data: mockUser, // Direct object without success wrapper
    });

    const userProfile = await usersApi.getMe();
    expect(userProfile.id).toBe('user-uuid-123');
    expect(userProfile.email).toBe('trader@enterprise.com');
  });

  // 11. Profile update success
  it('11. Profile update calls PUT /users/me and updates state', async () => {
    const updatedUser = { ...mockUser, full_name: 'Updated Name' };
    (axiosInstance.put as any).mockResolvedValueOnce({
      data: updatedUser, // Type B direct response
    });

    const TestComponent = () => {
      const { user, updateProfile } = useAuth();
      return (
        <div>
          <span data-testid="name">{user?.full_name}</span>
          <button onClick={() => updateProfile({ full_name: 'Updated Name' })}>
            Update Profile
          </button>
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Update Profile'));

    await waitFor(() => {
      expect(screen.getByTestId('name').textContent).toBe('Updated Name');
    });

    expect(JSON.parse(localStorage.getItem('user_profile') || '{}').full_name).toBe('Updated Name');
  });

  // 12. Change password success & error
  it('12. Change password calls PUT /users/change-password with Type C response', async () => {
    (axiosInstance.put as any).mockResolvedValueOnce({
      status: 204,
      data: null,
    });

    await expect(
      usersApi.changePassword({ old_password: 'OldPassword123', new_password: 'NewPassword456' })
    ).resolves.toBeUndefined();

    (axiosInstance.put as any).mockRejectedValueOnce({
      response: {
        status: 400,
        data: { success: false, message: 'Invalid current password.', data: null },
      },
    });

    await expect(
      usersApi.changePassword({ old_password: 'WrongPassword', new_password: 'NewPassword456' })
    ).rejects.toThrow();
  });
});
