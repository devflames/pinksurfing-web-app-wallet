'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { fetchWalletStatus } from '@/lib/wallet-api';
import { saveWalletIdentity } from '@/lib/wallet-identity-storage';
import { loadWalletSecrets } from '@/lib/wallet-secrets-storage';
import type { WalletProvisionStatus } from '@/lib/types/wallet';

export type ProvisionPhase = 'loading' | 'setup' | 'restore' | 'ready' | 'error';

export function useWalletProvision() {
  const { token, user } = useAuth();
  const [status, setStatus] = useState<WalletProvisionStatus | null>(null);
  const [phase, setPhase] = useState<ProvisionPhase>('loading');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const syncIdentity = useCallback(
    (chiaAddress: string, walletPk?: string) => {
      if (user?.email) {
        saveWalletIdentity(user.email, { chiaAddress, walletPk });
      }
    },
    [user?.email]
  );

  const refresh = useCallback(async () => {
    if (!token) {
      setStatus(null);
      setPhase('loading');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await fetchWalletStatus(token);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load wallet status');
      setStatus(null);
      setPhase('error');
    } finally {
      setLoading(false);
    }
  }, [token, user?.email, syncIdentity]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    loading,
    error,
    phase,
    refresh,
    provisioned: status?.provisioned === true,
    ready: phase === 'ready',
  };
}
