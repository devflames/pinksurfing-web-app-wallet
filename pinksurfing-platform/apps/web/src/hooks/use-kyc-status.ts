'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createIdentitySession,
  fetchIdentityStatus,
  identityCallbackUrl,
  openDiditVerification,
  type IdentityStatus,
} from '@/lib/identity-service';

const POLL_MS = 4000;

export function useKycStatus(token: string | null) {
  const [status, setStatus] = useState<IdentityStatus | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!token) {
      setStatus(null);
      setLoading(false);
      return false;
    }
    try {
      setError(null);
      const next = await fetchIdentityStatus(token);
      setStatus(next);
      if (next.verified) stopPolling();
      return next.verified;
    } catch {
      setStatus({ verified: false, status: 'not_started' });
      return false;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(() => {
      void refresh();
    }, POLL_MS);
  }, [refresh]);

  useEffect(() => {
    void refresh();
    return () => stopPolling();
  }, [refresh]);

  const startVerification = useCallback(async () => {
    if (!token) {
      setError('Sign in to verify your identity.');
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const session = await createIdentitySession(token, identityCallbackUrl());
      if (session.verified) {
        await refresh();
        return;
      }
      const url = session.verification_url || session.url;
      if (!url) {
        setError('Could not start verification. Try again shortly.');
        return;
      }
      startPolling();
      await openDiditVerification(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification unavailable');
    } finally {
      setStarting(false);
    }
  }, [token, refresh, startPolling]);

  return {
    status,
    loading,
    starting,
    error,
    verified: !!status?.verified,
    refresh,
    startVerification,
  };
}
