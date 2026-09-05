import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UserManagementPage from '@/pages/admin/UserManagementPage';
import { usersApi } from '@/services/api/usersApi';

const mockUsers = [
  {
    id: '1',
    email: 'admin@example.com',
    username: 'admin',
    full_name: 'Platform Admin',
    role: 'ADMIN',
    is_active: true,
    is_verified: true,
    last_login: '2026-08-14T10:00:00Z',
    created_at: '2026-08-01T10:00:00Z',
    updated_at: '2026-08-14T10:00:00Z',
  },
  {
    id: '2',
    email: 'trader@example.com',
    username: 'trader_one',
    full_name: 'Trader One',
    role: 'TRADER',
    is_active: false,
    is_verified: false,
    last_login: null,
    created_at: '2026-08-02T10:00:00Z',
    updated_at: '2026-08-14T10:00:00Z',
  },
];

describe('Admin User Management', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads users and renders role, status and verification', async () => {
    const listUsers = vi.spyOn(usersApi, 'listUsers').mockResolvedValue({
      total: 2,
      items: mockUsers,
    });

    render(
      <MemoryRouter>
        <UserManagementPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading users…');

    expect(await screen.findByText('Platform Admin')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Trader')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(listUsers).toHaveBeenCalledWith(0, 10, {
      search: undefined,
      role: undefined,
      is_active: undefined,
    });
  });

  it('sends server-side search, role and status filters', async () => {
    const listUsers = vi.spyOn(usersApi, 'listUsers').mockResolvedValue({
      total: 1,
      items: [mockUsers[0]],
    });

    render(
      <MemoryRouter>
        <UserManagementPage />
      </MemoryRouter>,
    );

    await screen.findByText('Platform Admin');

    fireEvent.change(screen.getByPlaceholderText('Name, username or email'), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'ADMIN' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'true' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(listUsers).toHaveBeenLastCalledWith(0, 10, {
        search: 'admin',
        role: 'ADMIN',
        is_active: true,
      });
    });
  });

  it('shows an actionable error state', async () => {
    vi.spyOn(usersApi, 'listUsers').mockRejectedValue(new Error('Forbidden'));

    render(
      <MemoryRouter>
        <UserManagementPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
