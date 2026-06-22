'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { fetchWalletStatus } from '@/lib/wallet-api';
import { saveWalletIdentity } from '@/lib/wallet-identity-storage';
import type { WalletProvisionStatus } from '@/lib/types/wallet';

export function useWalletProvision() {
  const { token, user } = useAuth();
  const [status, setStatus] = useState<WalletProvisionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await fetchWalletStatus(token);
      setStatus(next);
      if (next.provisioned && next.chiaAddress && user?.email) {
        saveWalletIdentity(user.email, {
          chiaAddress: next.chiaAddress,
          walletPk: next.walletPk,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load wallet status');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [token, user?.email]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    loading,
    error,
    refresh,
    provisioned: status?.provisioned === true,
  };
}
