'use client';



import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { withBasePath } from '@/lib/base-path';

import { clearSession, loadSession, saveSession } from '@/lib/auth-storage';

import { isAccessTokenExpired } from '@/lib/jwt-client';

import type { SessionUser } from '@/lib/types/user';



type AuthContextValue = {

  token: string | null;

  user: SessionUser | null;

  userId: string | null;

  loading: boolean;

  error: string | null;

  login: (email: string, password: string) => Promise<void>;

  loginDev: () => Promise<void>;

  loginWithGoogle: () => void;

  establishSession: (token: string, user: SessionUser, refresh?: string | null) => void;

  refreshSession: () => Promise<string | null>;

  logout: () => void;

  clearError: () => void;

};



const AuthContext = createContext<AuthContextValue | null>(null);



export function AuthProvider({ children }: { children: React.ReactNode }) {

  const [token, setToken] = useState<string | null>(null);

  const [user, setUser] = useState<SessionUser | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);



  const refreshSession = useCallback(async (): Promise<string | null> => {

    const session = loadSession();

    if (!session?.user) return null;



    try {

      const res = await fetch(withBasePath('/api/auth/refresh'), {

        method: 'POST',

        credentials: 'include',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(session.refresh ? { refresh: session.refresh } : {}),

      });

      const data = (await res.json().catch(() => ({}))) as {

        token?: string;

        refresh?: string;

        message?: string;

      };



      if (!res.ok || !data.token) {

        return null;

      }



      saveSession(data.token, session.user, data.refresh ?? session.refresh);

      setToken(data.token);

      setUser(session.user);

      setError(null);

      return data.token;

    } catch {

      return null;

    }

  }, []);



  useEffect(() => {

    let cancelled = false;



    (async () => {

      try {

        const session = loadSession();

        if (!session) return;



        if (isAccessTokenExpired(session.token)) {

          const nextToken = await refreshSession();

          if (!nextToken && !cancelled) {

            clearSession();

          }

          return;

        }



        if (!cancelled) {

          setToken(session.token);

          setUser(session.user);

        }

      } finally {

        if (!cancelled) setLoading(false);

      }

    })();



    return () => {

      cancelled = true;

    };

  }, [refreshSession]);



  const login = useCallback(async (email: string, password: string) => {

    setLoading(true);

    setError(null);

    try {

      const res = await fetch(withBasePath('/api/auth/login'), {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ email, password }),

      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {

        throw new Error(data.message || 'Login failed');

      }

      const sessionUser = data.user as SessionUser;

      const sessionToken = data.token as string;

      const refresh = data.refresh as string | undefined;

      saveSession(sessionToken, sessionUser, refresh);

      setToken(sessionToken);

      setUser(sessionUser);

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Login failed');

      throw e;

    } finally {

      setLoading(false);

    }

  }, []);



  const clearError = useCallback(() => setError(null), []);



  const loginWithGoogle = useCallback(() => {
    setError(null);

    // Same-origin OAuth keeps cookies on app.pinksurfing.com — required for reliable
    // mobile sign-in (cross-subdomain SSO cookies often fail on phone browsers).
    const onAppSubdomain =
      typeof window !== 'undefined' &&
      window.location.hostname === 'app.pinksurfing.com';
    const preferSameOrigin =
      process.env.NEXT_PUBLIC_GOOGLE_AUTH_SAME_ORIGIN === 'true' || onAppSubdomain;

    if (!preferSameOrigin) {
      const ssoStart =
        process.env.NEXT_PUBLIC_SSO_GOOGLE_START_URL ||
        (typeof window !== 'undefined' &&
        process.env.NEXT_PUBLIC_AUTH_MODE === 'production'
          ? 'https://auth.pinksurfing.com/api/auth/google/'
          : '');

      if (ssoStart) {
        const next = `${window.location.origin}${withBasePath('/auth/google/complete')}`;
        window.location.href = `${ssoStart}?next=${encodeURIComponent(next)}`;
        return;
      }
    }

    window.location.href = withBasePath('/api/auth/google');
  }, []);



  const establishSession = useCallback(

    (sessionToken: string, sessionUser: SessionUser, refresh?: string | null) => {

      saveSession(sessionToken, sessionUser, refresh);

      setToken(sessionToken);

      setUser(sessionUser);

      setError(null);

      setLoading(false);

    },

    []

  );



  const loginDev = useCallback(async () => {

    setLoading(true);

    setError(null);

    try {

      const res = await fetch(withBasePath('/api/dev-token'));

      if (!res.ok) throw new Error('Could not obtain dev token');

      const data = (await res.json()) as { token: string; userId: string; email?: string };

      const sessionUser: SessionUser = {

        id: data.userId,

        email: data.email || 'dev@test.local',

        firstName: 'Dev',

        lastName: 'User',

        mode: 'dev',

      };

      saveSession(data.token, sessionUser);

      setToken(data.token);

      setUser(sessionUser);

    } catch (e) {

      setError(e instanceof Error ? e.message : 'Dev login failed');

      throw e;

    } finally {

      setLoading(false);

    }

  }, []);



  const logout = useCallback(() => {

    clearSession();

    setToken(null);

    setUser(null);

    setError(null);

  }, []);



  return (

    <AuthContext.Provider

      value={{

        token,

        user,

        userId: user?.id ?? null,

        loading,

        error,

        login,

        loginDev,

        loginWithGoogle,

        establishSession,

        refreshSession,

        logout,

        clearError,

      }}

    >

      {children}

    </AuthContext.Provider>

  );

}



export function useAuth() {

  const ctx = useContext(AuthContext);

  if (!ctx) throw new Error('useAuth must be used within AuthProvider');

  return ctx;

}


