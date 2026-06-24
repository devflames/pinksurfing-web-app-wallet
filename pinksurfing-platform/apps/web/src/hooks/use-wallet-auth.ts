'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { deriveWalletFromMnemonic } from '@/lib/wallet-crypto';
import { loadWalletSecrets } from '@/lib/wallet-secrets-storage';

export type WalletCallerAuth = {
  chiaAddress: string;
  walletPk: string;
  signingSk: Uint8Array;
  mnemonic: string;
  launcherId?: string;
};

export function useWalletAuth() {
  const { user } = useAuth();
  const [auth, setAuth] = useState<WalletCallerAuth | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const email = user?.email;
    if (!email) {
      setAuth(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const secrets = await loadWalletSecrets(email);
        if (!secrets?.mnemonic) {
          if (!cancelled) setAuth(null);
          return;
        }
        const derived = await deriveWalletFromMnemonic(secrets.mnemonic);
        if (!cancelled) {
          setAuth({
            chiaAddress: derived.chiaAddress,
            walletPk: derived.walletPk,
            signingSk: derived.signingSk,
            mnemonic: secrets.mnemonic,
            launcherId: secrets.launcherId,
          });
        }
      } catch {
        if (!cancelled) setAuth(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  return { auth, loading, ready: !!auth };
}
