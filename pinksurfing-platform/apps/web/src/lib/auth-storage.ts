import type { SessionUser } from './types/user';

const TOKEN_KEY = 'ps_token';
const REFRESH_KEY = 'ps_refresh';
const USER_KEY = 'ps_user';

export type StoredSession = {
  token: string;
  user: SessionUser;
  refresh?: string | null;
};

export function loadSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY);
  const raw = localStorage.getItem(USER_KEY);
  if (!token || !raw) return null;
  try {
    return {
      token,
      refresh: localStorage.getItem(REFRESH_KEY),
      user: JSON.parse(raw) as SessionUser,
    };
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: SessionUser, refresh?: string | null) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh);
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function displayName(user: SessionUser | null): string {
  if (!user) return 'Guest';
  if (user.firstName || user.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }
  return user.email;
}
