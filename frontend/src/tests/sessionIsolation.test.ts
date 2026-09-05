import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLegacySharedSession,
  clearSession,
  getActiveSessionScope,
  getSessionToken,
  getSessionUser,
  saveSession,
  setActiveSessionScope,
} from '@/services/auth/session';

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

describe('Admin and Trader session isolation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('stores ADMIN and TRADER credentials in separate storage buckets', () => {
    saveSession('admin', 'admin-token', 'admin-refresh', adminUser);
    saveSession('trader', 'trader-token', 'trader-refresh', traderUser);

    expect(localStorage.getItem('admin_access_token')).toBe('admin-token');
    expect(localStorage.getItem('trader_access_token')).toBe('trader-token');
    expect(getSessionUser('admin')?.role).toBe('ADMIN');
    expect(getSessionUser('trader')?.role).toBe('TRADER');
  });

  it('keeps the active tab session scoped when another session is saved', () => {
    saveSession('admin', 'admin-token', 'admin-refresh', adminUser);
    expect(getActiveSessionScope()).toBe('admin');

    saveSession('trader', 'trader-token', 'trader-refresh', traderUser);
    expect(getActiveSessionScope()).toBe('trader');
    expect(getSessionToken()).toBe('trader-token');
    expect(getSessionToken('admin')).toBe('admin-token');
  });

  it('logout clears only the selected role session', () => {
    saveSession('admin', 'admin-token', 'admin-refresh', adminUser);
    saveSession('trader', 'trader-token', 'trader-refresh', traderUser);
    setActiveSessionScope('admin');

    clearSession('admin');

    expect(localStorage.getItem('admin_access_token')).toBeNull();
    expect(localStorage.getItem('trader_access_token')).toBe('trader-token');
  });

  it('removes the legacy shared session keys during migration', () => {
    localStorage.setItem('access_token', 'legacy-token');
    localStorage.setItem('refresh_token', 'legacy-refresh');
    localStorage.setItem('user_profile', JSON.stringify(traderUser));

    clearLegacySharedSession();

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('user_profile')).toBeNull();
  });
});
