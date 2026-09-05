import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from '@/pages/auth/LoginPage';
import { AuthContext } from '@/context/AuthContext';
import { ROUTES } from '@/constants/routes';

const adminUser = {
  id: 'admin-1',
  email: 'admin@enterprise.com',
  username: 'admin',
  full_name: 'Enterprise Admin',
  role: 'ADMIN',
  is_active: true,
  is_verified: true,
};

const traderUser = {
  ...adminUser,
  id: 'trader-1',
  email: 'trader@enterprise.com',
  username: 'trader',
  role: 'TRADER',
};

const createAuth = (user: typeof adminUser | null = null) => ({
  user,
  isAuthenticated: false,
  loading: false,
  login: vi.fn(async (credentials: { email: string; password: string }) => {
    return credentials.email === adminUser.email ? adminUser : traderUser;
  }),
  logout: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
});

describe('Admin-aware login routing', () => {
  beforeEach(() => localStorage.clear());

  it('routes ADMIN users to the Admin Control Center', async () => {
    const auth = createAuth();

    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
          <Routes>
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.ADMIN_DASHBOARD} element={<div>ADMIN CONTROL CENTER</div>} />
            <Route path={ROUTES.DASHBOARD} element={<div>TRADER DASHBOARD</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    fireEvent.change(screen.getByPlaceholderText('trader@enterprise.com'), {
      target: { value: adminUser.email },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(screen.getByText('ADMIN CONTROL CENTER')).toBeInTheDocument());
    expect(screen.queryByText('TRADER DASHBOARD')).not.toBeInTheDocument();
  });

  it('keeps TRADER users on the normal trading dashboard', async () => {
    const auth = createAuth();

    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[ROUTES.LOGIN]}>
          <Routes>
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.ADMIN_DASHBOARD} element={<div>ADMIN CONTROL CENTER</div>} />
            <Route path={ROUTES.DASHBOARD} element={<div>TRADER DASHBOARD</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    fireEvent.change(screen.getByPlaceholderText('trader@enterprise.com'), {
      target: { value: traderUser.email },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'Password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(screen.getByText('TRADER DASHBOARD')).toBeInTheDocument());
    expect(screen.queryByText('ADMIN CONTROL CENTER')).not.toBeInTheDocument();
  });
});
