'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchKeyVaultStatus,
  fetchOpenSwaps,
  fetchSwapsForAddress,
  fetchWalletInfo,
  formatBtc,
  formatXch,
  lookupKeyVault,
} from '@/lib/wallet-api';
import { getWalletBase } from '@/lib/api-client';
import type { AtomicSwap, KeyVaultStatus, WalletHealth } from '@/lib/types/wallet';
import { WalletIdentityCard } from '@/components/wallet/WalletIdentityCard';
import { useWalletIdentity } from '@/hooks/use-wallet-identity';

export function WalletPanel() {
  const { chiaAddress, walletLive } = useWalletIdentity();
  const [health, setHealth] = useState<WalletHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [openSwaps, setOpenSwaps] = useState<AtomicSwap[]>([]);
  const [mySwaps, setMySwaps] = useState<AtomicSwap[]>([]);
  const [launcherId, setLauncherId] = useState<string | null>(null);
  const [vaultStatus, setVaultStatus] = useState<KeyVaultStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [vaultMessage, setVaultMessage] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    if (!walletLive) return;
    setLoading(true);
    setHealthError(null);
    setVaultMessage(null);
    try {
      const [info, swaps] = await Promise.all([fetchWalletInfo(), fetchOpenSwaps(10)]);
      setHealth(info);
      setOpenSwaps(swaps);
    } catch (e) {
      setHealthError(e instanceof Error ? e.message : 'Wallet unreachable');
      setHealth(null);
      setOpenSwaps([]);
    } finally {
      setLoading(false);
    }
  }, [walletLive]);

  const loadVaultAndSwaps = useCallback(async () => {
    const addr = chiaAddress.trim();
    if (!addr || !walletLive) {
      setMySwaps([]);
      setLauncherId(null);
      setVaultStatus(null);
      return;
    }
    setVaultMessage(null);
    try {
      const [lookup, swaps] = await Promise.all([
        lookupKeyVault(addr),
        fetchSwapsForAddress(addr, 10),
      ]);
      setMySwaps(swaps);
      if (lookup.success && lookup.launcherId) {
        setLauncherId(lookup.launcherId);
        const status = await fetchKeyVaultStatus(lookup.launcherId);
        setVaultStatus(status);
      } else {
        setLauncherId(null);
        setVaultStatus(null);
        setVaultMessage(lookup.message || 'No KeyVault for this address');
      }
    } catch (e) {
      setVaultMessage(e instanceof Error ? e.message : 'KeyVault lookup failed');
      setLauncherId(null);
      setVaultStatus(null);
    }
  }, [chiaAddress, walletLive]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  useEffect(() => {
    const t = setTimeout(loadVaultAndSwaps, 400);
    return () => clearTimeout(t);
  }, [loadVaultAndSwaps]);

  const pythonOk = health?.keyvault?.python?.success !== false;

  return (
    <div className="border-t border-[var(--ps-brd)] px-3 py-2">
      <WalletIdentityCard variant="compact" showEdit={false} />

      {walletLive ? (
        <>
          <div className="mb-2 mt-2 flex items-center justify-between">
            <div className="text-[9px] uppercase tracking-wide text-[var(--ps-muted)]">
              KeyVault &amp; swaps
            </div>
            <button
              type="button"
              onClick={() => {
                loadWallet();
                loadVaultAndSwaps();
              }}
              disabled={loading}
              className="text-[9px] text-[var(--ps-dim)] hover:text-[var(--ps-white)]"
            >
              {loading ? '…' : '↻'}
            </button>
          </div>

          {healthError && (
            <p className="mb-2 text-[10px] text-[var(--ps-red)]">{healthError}</p>
          )}

          {health && (
            <div className="mb-2 space-y-0.5 text-[10px]">
              <div className="text-[var(--ps-white)]">{health.name ?? 'ps-wallet-backend'}</div>
              <div className="flex gap-2 text-[var(--ps-dim)]">
                <span>
                  Node{' '}
                  <span className="text-[var(--ps-green,#4ade80)]">
                    {health.keyvault?.nodejs ?? '—'}
                  </span>
                </span>
                <span>
                  KeyVault{' '}
                  <span
                    className={
                      pythonOk ? 'text-[var(--ps-green,#4ade80)]' : 'text-[var(--ps-amber,#fbbf24)]'
                    }
                  >
                    {pythonOk ? 'ok' : 'down'}
                  </span>
                </span>
              </div>
            </div>
          )}

          <div className="mb-2 text-[10px]">
            <div className="mb-1 text-[9px] uppercase tracking-wide text-[var(--ps-muted)]">
              KeyVault
            </div>
            {launcherId ? (
              <div className="text-[var(--ps-white)]">
                <div className="truncate text-[var(--ps-dim)]" title={launcherId}>
                  {launcherId.slice(0, 16)}…
                </div>
                <div className="text-[var(--ps-cyan)]">
                  {vaultStatus?.status ?? vaultStatus?.message ?? 'unknown'}
                </div>
              </div>
            ) : (
              <p className="text-[var(--ps-dim)]">
                {vaultMessage ?? (chiaAddress ? 'Looking up vault…' : 'Set address above')}
              </p>
            )}
          </div>

          <div className="mb-2">
            <div className="mb-1 text-[9px] uppercase tracking-wide text-[var(--ps-muted)]">
              Open BTC swaps ({openSwaps.length})
            </div>
            <div className="space-y-1.5">
              {openSwaps.slice(0, 5).map((s) => (
                <SwapRow key={s.id} swap={s} />
              ))}
              {openSwaps.length === 0 && !healthError && (
                <p className="text-[10px] text-[var(--ps-dim)]">No open offers</p>
              )}
            </div>
          </div>

          {mySwaps.length > 0 && (
            <div className="mb-2">
              <div className="mb-1 text-[9px] uppercase tracking-wide text-[var(--ps-muted)]">
                Your swaps ({mySwaps.length})
              </div>
              <div className="space-y-1.5">
                {mySwaps.slice(0, 3).map((s) => (
                  <SwapRow key={s.id} swap={s} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 text-[9px] text-[var(--ps-dim)]">
          Set <code className="text-[8px]">NEXT_PUBLIC_WALLET_LIVE=true</code> for live KeyVault
          lookup and atomic swaps.
        </p>
      )}

      <p className="mt-2 break-all text-[9px] text-[var(--ps-dim)]">{getWalletBase()}</p>
    </div>
  );
}

function SwapRow({ swap }: { swap: AtomicSwap }) {
  const dir = swap.direction === 'xch_to_btc' ? 'XCH → BTC' : 'BTC → XCH';
  return (
    <div className="rounded border border-[var(--ps-brd)] bg-[var(--ps-card)] p-2 text-[10px]">
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium text-[var(--ps-cyan)]">{dir}</span>
        <span className="text-[var(--ps-dim)]">{swap.status}</span>
      </div>
      <div className="mt-0.5 text-[var(--ps-white)]">
        {formatXch(swap.xchAmountMojos)} XCH ↔ {formatBtc(swap.btcAmountSats)} BTC
      </div>
    </div>
  );
}
