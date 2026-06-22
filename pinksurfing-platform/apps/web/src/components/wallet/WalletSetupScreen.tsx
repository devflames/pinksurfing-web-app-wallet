'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { linkWalletToSso } from '@/lib/wallet-api';
import { loadWalletIdentity } from '@/lib/wallet-identity-storage';

type Props = {
  onLinked: () => Promise<void> | void;
};

export function WalletSetupScreen({ onLinked }: Props) {
  const { token, user } = useAuth();
  const stored = user?.email ? loadWalletIdentity(user.email) : null;

  const [chiaAddress, setChiaAddress] = useState(stored?.chiaAddress ?? '');
  const [walletPk, setWalletPk] = useState(stored?.walletPk ?? '');
  const [launcherId, setLauncherId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Session expired — please sign in again.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await linkWalletToSso(token, {
        chiaAddress: chiaAddress.trim(),
        walletPk: walletPk.trim(),
        launcherId: launcherId.trim() || undefined,
      });
      await onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link wallet');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ps-gradient-border bg-[var(--ps-surf)] text-xl font-bold text-[var(--ps-primary)]">
            P
          </div>
          <h1 className="text-lg font-semibold text-[var(--ps-text)]">Set up your wallet</h1>
          <p className="mt-2 text-sm text-[var(--ps-muted)]">
            Your keys stay on this device. We only store a link between your PinkSurfing account
            and your wallet address so you get the same wallet when you sign in again.
          </p>
        </div>

        <ol className="mb-5 space-y-2 text-sm text-[var(--ps-muted)]">
          <li>1. Generate or restore a wallet on this device</li>
          <li>2. Back up to Google Drive or save your recovery PDF</li>
          <li>3. Link your wallet to this account</li>
        </ol>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--ps-muted)]">Wallet address</span>
            <input
              type="text"
              value={chiaAddress}
              onChange={(e) => setChiaAddress(e.target.value)}
              placeholder="xch1…"
              required
              className="w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-bg)] px-3 py-2 text-[var(--ps-text)] outline-none focus:border-[var(--ps-primary)]"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-[var(--ps-muted)]">Wallet public key (hex)</span>
            <input
              type="text"
              value={walletPk}
              onChange={(e) => setWalletPk(e.target.value)}
              placeholder="Ed25519 public key"
              required
              className="w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-bg)] px-3 py-2 font-mono text-xs text-[var(--ps-text)] outline-none focus:border-[var(--ps-primary)]"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-[var(--ps-muted)]">
              KeyVault launcher ID <span className="text-xs">(optional)</span>
            </span>
            <input
              type="text"
              value={launcherId}
              onChange={(e) => setLauncherId(e.target.value)}
              placeholder="If you already deployed a vault"
              className="w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-bg)] px-3 py-2 font-mono text-xs text-[var(--ps-text)] outline-none focus:border-[var(--ps-primary)]"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[var(--ps-primary)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Linking…' : 'Link wallet & continue'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[var(--ps-muted)]">
          Full on-device wallet creation and Drive backup are coming in the next release.
        </p>
      </div>
    </div>
  );
}
