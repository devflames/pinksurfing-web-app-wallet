'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ThirdwebOnrampModal } from '@/components/wallet/ThirdwebOnrampModal';
import { useAuth } from '@/lib/auth-context';
import { useWalletAuth } from '@/hooks/use-wallet-auth';
import { useWalletIdentity } from '@/hooks/use-wallet-identity';
import { saveSwapSecret } from '@/lib/swap-secrets-storage';
import {
  btcEstimateToSats,
  createAtomicSwap,
  fetchVaultBalance,
  formatBtc,
  formatXch,
  lookupKeyVault,
  mojosToUsd,
  usdToBtcEstimate,
} from '@/lib/wallet-api';

type Props = {
  onBack: () => void;
  onInitiate?: () => void;
  /** USD value from contract or vault estimate */
  vaultUsd?: number;
  /** Override XCH mojos to swap (defaults from vaultUsd) */
  xchAmountMojos?: string;
};

const MOJOS_PER_XCH = 1_000_000_000_000;

function usdToMojos(usd: number, xchUsd = Number(process.env.NEXT_PUBLIC_XCH_USD_RATE) || 5): string {
  const xch = usd / xchUsd;
  return String(Math.floor(xch * MOJOS_PER_XCH));
}

export function BtcSwapView({
  onBack,
  onInitiate,
  vaultUsd,
  xchAmountMojos: xchOverride,
}: Props) {
  const { user } = useAuth();
  const { auth, ready } = useWalletAuth();
  const { chiaAddress, btcPubkey, walletLive } = useWalletIdentity();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [vaultBalanceMojos, setVaultBalanceMojos] = useState<number | null>(null);
  const [launcherId, setLauncherId] = useState<string | null>(null);
  const [showOnramp, setShowOnramp] = useState(false);

  const loadVault = useCallback(async () => {
    const addr = chiaAddress.trim();
    if (!addr || !walletLive) return;
    const lookup = await lookupKeyVault(addr);
    if (!lookup.success || !lookup.launcherId) {
      setVaultBalanceMojos(null);
      setLauncherId(null);
      return;
    }
    setLauncherId(lookup.launcherId);
    const bal = await fetchVaultBalance(lookup.launcherId);
    if (bal.success && bal.totalBalance != null) {
      setVaultBalanceMojos(bal.totalBalance);
    }
  }, [chiaAddress, walletLive]);

  useEffect(() => {
    void loadVault();
  }, [loadVault]);

  const effectiveUsd = useMemo(() => {
    if (vaultUsd != null) return vaultUsd;
    if (vaultBalanceMojos != null) return mojosToUsd(vaultBalanceMojos);
    return 0;
  }, [vaultUsd, vaultBalanceMojos]);

  const xchMojos = useMemo(() => {
    if (xchOverride) return xchOverride;
    if (vaultBalanceMojos != null && vaultBalanceMojos > 0) {
      return String(vaultBalanceMojos);
    }
    if (effectiveUsd > 0) return usdToMojos(effectiveUsd);
    return '0';
  }, [xchOverride, vaultBalanceMojos, effectiveUsd]);

  const btcEstimate = useMemo(() => usdToBtcEstimate(effectiveUsd), [effectiveUsd]);

  const handleInitiate = async () => {
    onInitiate?.();
    if (!walletLive) {
      setStatus('Enable NEXT_PUBLIC_WALLET_LIVE=true and run Matt wallet backend.');
      return;
    }
    if (!ready || !auth) {
      setStatus('Restore your wallet under Me → Your wallet before swapping.');
      return;
    }
    if (!chiaAddress.trim()) {
      setStatus('Add your wallet address under Me → Your wallet first.');
      return;
    }
    if (Number(xchMojos) <= 0) {
      setStatus('Vault balance is zero — deposit XCH to your KeyVault first.');
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const result = await createAtomicSwap(
        {
          initiatorChiaAddress: chiaAddress.trim(),
          initiatorBtcPubkey: btcPubkey.trim() || undefined,
          direction: 'xch_to_btc',
          xchAmountMojos: xchMojos,
          btcAmountSats: btcEstimateToSats(btcEstimate),
        },
        auth
      );
      if (result.secret && user?.email) {
        saveSwapSecret(user.email, {
          swapId: result.swap.id,
          secret: result.secret,
          createdAt: new Date().toISOString(),
        });
      }
      setStatus(
        `Swap offer ${result.swap.id.slice(0, 8)}… created (${formatXch(result.swap.xchAmountMojos)} XCH → ${formatBtc(result.swap.btcAmountSats)} BTC). ` +
          'Preimage saved on this device. Counterparty accepts via HTLC — fund Chia HTLC from vault, then record coin id.'
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Swap create failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
      <div className="mb-1 text-sm font-medium text-[var(--ps-white)]">Atomic swap → Bitcoin</div>
      <p className="mb-3.5 text-[11px] leading-relaxed text-[var(--ps-muted)]">
        Swap vault balance to BTC using submarine atomic swaps. Funds lock in on-chain HTLCs — PinkSurfing
        does not hold custody.
      </p>

      <div className="mb-2.5 rounded-[10px] border border-[#1E3A5F] bg-[#0D1220] p-3">
        <div className="mb-2 flex justify-between">
          <span className="text-[10px] text-[var(--ps-muted)]">Vault balance</span>
          <span className="text-sm font-medium text-[var(--ps-white)]">
            {vaultBalanceMojos != null
              ? `${formatXch(vaultBalanceMojos)} XCH`
              : launcherId
                ? '…'
                : '—'}
          </span>
        </div>
        {effectiveUsd > 0 && (
          <div className="mb-2 flex justify-between text-[10px] text-[var(--ps-dim)]">
            <span>≈ USD</span>
            <span>${effectiveUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        <div className="my-2 flex items-center gap-2">
          <div className="h-px flex-1 bg-[var(--ps-brd)]" />
          <span className="text-[var(--ps-muted)]">⇅</span>
          <div className="h-px flex-1 bg-[var(--ps-brd)]" />
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-[var(--ps-muted)]">You receive (BTC)</span>
          <span className="text-sm font-medium text-[#F7931A]">≈ {btcEstimate} BTC</span>
        </div>
      </div>

      <div className="mb-2.5 rounded-lg border border-[#F7931A30] bg-[#F7931A10] p-2.5">
        <div className="mb-1 text-[10px] font-medium text-[#F7931A]">₿ How it works (non-custodial)</div>
        <ol className="list-decimal space-y-0.5 pl-4 text-[9px] leading-relaxed text-[var(--ps-muted)]">
          <li>Create offer — preimage stored on this device only</li>
          <li>Lock XCH in Chia HTLC (from KeyVault withdraw flow or external wallet)</li>
          <li>Counterparty locks BTC and accepts with HTLC details</li>
          <li>Claim with preimage — atomic settlement or timeout refund</li>
        </ol>
      </div>

      <div className="mb-2.5 rounded-lg border border-[#6EE7FF30] bg-[#6EE7FF10] p-2.5">
        <div className="mb-1 text-[10px] font-medium text-[var(--ps-cyan)]">Need funds first?</div>
        <p className="mb-2 text-[9px] leading-relaxed text-[var(--ps-muted)]">
          Use Thirdweb onramp to buy crypto with card, then swap vault XCH → BTC.
        </p>
        <button
          type="button"
          onClick={() => setShowOnramp(true)}
          className="w-full rounded-md border border-[var(--ps-cyan)]/40 py-2 text-[10px] font-medium text-[var(--ps-cyan)]"
        >
          Buy crypto (Thirdweb onramp)
        </button>
      </div>

      {chiaAddress ? (
        <p className="mb-2 break-all text-[9px] text-[var(--ps-dim)]">
          From: {chiaAddress.slice(0, 20)}…
        </p>
      ) : (
        <p className="mb-2 text-[9px] text-[var(--ps-amber,#fbbf24)]">
          Set your wallet address on the Me tab before swapping.
        </p>
      )}

      {status && <p className="mb-2 text-[9px] text-[var(--ps-cyan)]">{status}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void handleInitiate()}
          disabled={busy}
          className="flex-1 rounded-md border border-[#F7931A50] bg-[#F7931A15] py-2 text-center text-[10px] font-medium text-[#F7931A] disabled:opacity-50"
        >
          {busy ? 'Creating…' : '₿ Create swap offer'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-[var(--ps-brd)] bg-[var(--ps-card)] px-3 py-2 text-[10px] text-[var(--ps-dim)]"
        >
          Cancel
        </button>
      </div>
      <ThirdwebOnrampModal
        open={showOnramp}
        onClose={() => setShowOnramp(false)}
        amountUsd={effectiveUsd > 0 ? effectiveUsd : 25}
      />
    </div>
  );
}
