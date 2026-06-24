'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useWalletAuth } from '@/hooks/use-wallet-auth';
import { useWalletIdentity } from '@/hooks/use-wallet-identity';
import { executeVaultWithdraw } from '@/lib/vault-withdraw-flow';
import { fetchVaultBalance, formatXch, lookupKeyVault } from '@/lib/wallet-api';

type Props = {
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
  compact?: boolean;
};

export function VaultWithdrawForm({ onSuccess, onError, compact }: Props) {
  const { user } = useAuth();
  const { auth, ready } = useWalletAuth();
  const { chiaAddress, walletLive } = useWalletIdentity();
  const [launcherId, setLauncherId] = useState<string | null>(null);
  const [balanceMojos, setBalanceMojos] = useState(0);
  const [destination, setDestination] = useState('');
  const [amountXch, setAmountXch] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadVault = async () => {
    const addr = chiaAddress.trim();
    if (!addr || !walletLive) return;
    const lookup = await lookupKeyVault(addr);
    if (!lookup.success || !lookup.launcherId) {
      setStatus(lookup.message ?? 'No KeyVault found');
      return;
    }
    setLauncherId(lookup.launcherId);
    const bal = await fetchVaultBalance(lookup.launcherId);
    if (bal.success && bal.totalBalance != null) {
      setBalanceMojos(bal.totalBalance);
    }
  };

  const handleWithdraw = async () => {
    if (!ready || !auth || !launcherId) {
      setStatus('Complete wallet setup (Me → Your wallet) first.');
      return;
    }
    const dest = destination.trim();
    const xch = Number(amountXch);
    if (!dest || !Number.isFinite(xch) || xch <= 0) {
      setStatus('Enter destination address and amount.');
      return;
    }
    const amountMojos = Math.floor(xch * 1_000_000_000_000);
    if (amountMojos > balanceMojos) {
      setStatus('Amount exceeds vault balance.');
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const result = await executeVaultWithdraw({
        launcherId,
        ownerPubkeyHex: auth.walletPk,
        mnemonic: auth.mnemonic,
        destinationAddress: dest,
        amountMojos,
      });
      const msg = `Withdrawal submitted: ${formatXch(result.amount)} XCH → ${result.destination.slice(0, 16)}…`;
      setStatus(msg);
      onSuccess?.(msg);
      setAmountXch('');
      await loadVault();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Withdraw failed';
      setStatus(msg);
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  };

  if (!walletLive) {
    return (
      <p className="text-[9px] text-[var(--ps-dim)]">
        Enable <code className="text-[8px]">NEXT_PUBLIC_WALLET_LIVE=true</code> for vault withdraw.
      </p>
    );
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {!launcherId && (
        <button
          type="button"
          onClick={() => void loadVault().catch(() => setStatus('Vault lookup failed'))}
          className="w-full rounded-md border border-[var(--ps-brd)] py-2 text-[10px] text-[var(--ps-cyan)]"
        >
          Load vault balance
        </button>
      )}
      {launcherId && (
        <p className="text-[10px] text-[var(--ps-white)]">
          Vault balance:{' '}
          <span className="text-[var(--ps-cyan)]">{formatXch(balanceMojos)} XCH</span>
        </p>
      )}
      <div>
        <label className="mb-1 block text-[9px] text-[var(--ps-dim)]">Destination XCH address</label>
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="xch1…"
          className="w-full rounded-md border border-[var(--ps-brd)] bg-white/5 px-2 py-1.5 text-[10px] text-[var(--ps-white)] outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-[9px] text-[var(--ps-dim)]">Amount (XCH)</label>
        <input
          value={amountXch}
          onChange={(e) => setAmountXch(e.target.value)}
          placeholder="0.00"
          type="number"
          min="0"
          step="0.0001"
          className="w-full rounded-md border border-[var(--ps-brd)] bg-white/5 px-2 py-1.5 text-[10px] text-[var(--ps-white)] outline-none"
        />
      </div>
      {!ready && user?.email && (
        <p className="text-[9px] text-[var(--ps-amber,#fbbf24)]">
          Restore wallet from Me tab to sign withdrawals.
        </p>
      )}
      <button
        type="button"
        disabled={busy || !launcherId}
        onClick={() => void handleWithdraw()}
        className="w-full rounded-md border border-[var(--ps-cyan)]/40 bg-[var(--ps-cyan)]/10 py-2 text-[10px] font-medium text-[var(--ps-cyan)] disabled:opacity-50"
      >
        {busy ? 'Signing & submitting…' : 'Withdraw from vault'}
      </button>
      {status && <p className="text-[9px] text-[var(--ps-muted)]">{status}</p>}
    </div>
  );
}
