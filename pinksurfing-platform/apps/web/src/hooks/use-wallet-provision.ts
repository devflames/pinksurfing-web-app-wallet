'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { fetchWalletStatus } from '@/lib/wallet-api';
import { saveWalletIdentity } from '@/lib/wallet-identity-storage';
import { loadWalletSecrets } from '@/lib/wallet-secrets-storage';
import type { WalletProvisionStatus } from '@/lib/types/wallet';

export type ProvisionPhase = 'loading' | 'setup' | 'restore' | 'ready' | 'error';

function isSessionExpiredMessage(message: string): boolean {
  return /jwt expired|token expired|expired/i.test(message);
}

export function useWalletProvision() {
  const { token, user, refreshSession } = useAuth();
  const [status, setStatus] = useState<WalletProvisionStatus | null>(null);
  const [phase, setPhase] = useState<ProvisionPhase>('loading');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  const syncIdentity = useCallback(
    (chiaAddress: string, walletPk?: string) => {
      if (user?.email) {
        saveWalletIdentity(user.email, { chiaAddress, walletPk });
      }
    },
    [user?.email]
  );

  const loadStatus = useCallback(
    async (accessToken: string) => {
      const next = await fetchWalletStatus(accessToken);
      setStatus(next);

      if (!next.provisioned) {
        setPhase('setup');
        return;
      }

      const local = user?.email ? await loadWalletSecrets(user.email) : null;
      if (local?.chiaAddress) {
        syncIdentity(local.chiaAddress, local.walletPk);
        setPhase('ready');
        return;
      }

      if (next.chiaAddress) {
        syncIdentity(next.chiaAddress, next.walletPk);
      }
      setPhase('restore');
    },
    [user?.email, syncIdentity]
  );

  const refresh = useCallback(async () => {
    if (!token) {
      setStatus(null);
      setPhase('loading');
      return;
    }

    setLoading(true);
    setError(null);
    setSessionExpired(false);
    try {
      await loadStatus(token);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not load wallet status';
      if (isSessionExpiredMessage(message)) {
        const nextToken = await refreshSession();
        if (nextToken) {
          try {
            await loadStatus(nextToken);
            return;
          } catch (retryErr) {
            const retryMessage =
              retryErr instanceof Error ? retryErr.message : 'Could not load wallet status';
            setError(retryMessage);
            setSessionExpired(isSessionExpiredMessage(retryMessage));
          }
        } else {
          setError('Your session expired. Please sign in again.');
          setSessionExpired(true);
        }
      } else {
        setError(message);
      }
      setStatus(null);
      setPhase('error');
    } finally {
      setLoading(false);
    }
  }, [token, loadStatus, refreshSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    loading,
    error,
    sessionExpired,
    phase,
    refresh,
    provisioned: status?.provisioned === true,
    ready: phase === 'ready',
  };
}
