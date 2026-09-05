import { UserResponse } from '@/types/auth';

export type SessionScope = 'admin' | 'trader';

const SESSION_STORAGE_KEY = 'active_session_scope';

const STORAGE_KEYS: Record<SessionScope, { accessToken: string; refreshToken: string; userProfile: string }> = {
  admin: { accessToken: 'admin_access_token', refreshToken: 'admin_refresh_token', userProfile: 'admin_user_profile' },
  trader: { accessToken: 'trader_access_token', refreshToken: 'trader_refresh_token', userProfile: 'trader_user_profile' },
};

export const getSessionScopeForRole = (role?: string | null): SessionScope => role === 'ADMIN' ? 'admin' : 'trader';

export const getRouteSessionScope = (pathname = typeof window !== 'undefined' ? window.location.pathname : ''): SessionScope | null => {
  if (pathname.startsWith('/admin') || pathname.startsWith('/kill-switch')) return 'admin';
  if (
    pathname.startsWith('/dashboard') || pathname.startsWith('/orders') || pathname.startsWith('/portfolio') ||
    pathname.startsWith('/watchlist') || pathname.startsWith('/strategy') || pathname.startsWith('/strategies') ||
    pathname.startsWith('/journal') || pathname.startsWith('/brokers') || pathname.startsWith('/paper')
  ) return 'trader';
  return null;
};

export const getActiveSessionScope = (pathname = typeof window !== 'undefined' ? window.location.pathname : ''): SessionScope => {
  const routeScope = getRouteSessionScope(pathname);
  if (routeScope) return routeScope;

  const sessionStored = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (sessionStored === 'admin' || sessionStored === 'trader') return sessionStored as SessionScope;

  const localStored = localStorage.getItem(SESSION_STORAGE_KEY);
  if (localStored === 'admin' || localStored === 'trader') return localStored as SessionScope;

  return 'trader';
};

export const setActiveSessionScope = (scope: SessionScope): void => {
  sessionStorage.setItem(SESSION_STORAGE_KEY, scope);
  localStorage.setItem(SESSION_STORAGE_KEY, scope);
};

export const clearActiveSessionScope = (): void => {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

export const getSessionStorageKeys = (scope: SessionScope) => STORAGE_KEYS[scope];

export const getSessionToken = (scope = getActiveSessionScope()): string | null =>
  scope ? localStorage.getItem(STORAGE_KEYS[scope].accessToken) : null;

export const getSessionRefreshToken = (scope = getActiveSessionScope()): string | null =>
  scope ? localStorage.getItem(STORAGE_KEYS[scope].refreshToken) : null;

export const getSessionUser = (scope = getActiveSessionScope()): UserResponse | null => {
  if (!scope) return null;
  const stored = localStorage.getItem(STORAGE_KEYS[scope].userProfile);
  if (!stored) return null;
  try { return JSON.parse(stored) as UserResponse; } catch { return null; }
};

export const saveSession = (scope: SessionScope, accessToken: string, refreshToken: string, user: UserResponse): void => {
  const keys = STORAGE_KEYS[scope];
  localStorage.setItem(keys.accessToken, accessToken);
  localStorage.setItem(keys.refreshToken, refreshToken);
  localStorage.setItem(keys.userProfile, JSON.stringify(user));
  setActiveSessionScope(scope);
};

export const updateSessionUser = (scope: SessionScope, user: UserResponse): void => {
  localStorage.setItem(STORAGE_KEYS[scope].userProfile, JSON.stringify(user));
};

export const clearSession = (scope: SessionScope): void => {
  const keys = STORAGE_KEYS[scope];
  localStorage.removeItem(keys.accessToken);
  localStorage.removeItem(keys.refreshToken);
  localStorage.removeItem(keys.userProfile);
  if (getActiveSessionScope() === scope) clearActiveSessionScope();
};

export const clearLegacySharedSession = (): void => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_profile');
};
