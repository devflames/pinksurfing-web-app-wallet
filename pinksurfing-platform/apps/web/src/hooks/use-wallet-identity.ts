'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  loadWalletIdentity,
  saveWalletIdentity,
  type WalletIdentity,
} from '@/lib/wallet-identity-storage';

const DEFAULT_CHIA = process.env.NEXT_PUBLIC_DEV_CHIA_ADDRESS?.trim() || '';

export function useWalletIdentity() {
  const { user } = useAuth();
  const email = user?.email ?? '';

  const [chiaAddress, setChiaAddress] = useState('');
  const [btcPubkey, setBtcPubkey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!email) {
      setChiaAddress(DEFAULT_CHIA);
      setBtcPubkey('');
      setSaved(false);
      return;
    }
    const stored = loadWalletIdentity(email);
    if (stored) {
      setChiaAddress(stored.chiaAddress);
      setBtcPubkey(stored.btcPubkey ?? '');
      setSaved(true);
    } else {
      setChiaAddress(DEFAULT_CHIA);
      setBtcPubkey('');
      setSaved(false);
    }
  }, [email]);

  const persist = useCallback(
    (next: WalletIdentity) => {
      setChiaAddress(next.chiaAddress);
      setBtcPubkey(next.btcPubkey ?? '');
      if (email && next.chiaAddress.trim()) {
        saveWalletIdentity(email, next);
        setSaved(true);
      }
    },
    [email]
  );

  return {
    email,
    pspayId: user?.pspayId,
    chiaAddress,
    btcPubkey,
    setChiaAddress,
    setBtcPubkey,
    persist,
    saved,
    walletLive: process.env.NEXT_PUBLIC_WALLET_LIVE === 'true',
  };
}
