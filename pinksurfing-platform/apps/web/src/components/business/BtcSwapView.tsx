'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useWalletIdentity } from '@/hooks/use-wallet-identity';
import { createAtomicSwap, formatBtc, formatXch } from '@/lib/wallet-api';

type Props = {
  onBack: () => void;
  onInitiate?: () => void;
  vaultUsd?: number;
  btcEstimate?: string;
};

const MOJOS_PER_XCH = 1_000_000_000_000;
const SATS_PER_BTC = 100_000_000;

function usdToMojos(usd: number, xchUsd = 18): string {
  const xch = usd / xchUsd;
  return String(Math.floor(xch * MOJOS_PER_XCH));
}

function btcStrToSats(btc: string): string {
  const n = Number(btc);
  if (!Number.isFinite(n)) return '0';
  return String(Math.floor(n * SATS_PER_BTC));
}

export function BtcSwapView({
  onBack,
  onInitiate,
  vaultUsd = 19000,
  btcEstimate = '0.2143',
}: Props) {
  const { token } = useAuth();
  const { chiaAddress, btcPubkey, walletLive } = useWalletIdentity();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleInitiate = async () => {
    onInitiate?.();
    if (!walletLive) {
      setStatus('Enable NEXT_PUBLIC_WALLET_LIVE=true and run Matt wallet backend.');
      return;
    }
    if (!chiaAddress.trim()) {
      setStatus('Add your Chia address under Me → Your wallet first.');
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
          xchAmountMojos: usdToMojos(vaultUsd),
          btcAmountSats: btcStrToSats(btcEstimate),
        },
        token
      );
      setStatus(
        `Swap offer created (${formatXch(result.swap.xchAmountMojos)} XCH → ${formatBtc(result.swap.btcAmountSats)} BTC). ` +
          'Counterparty accepts via HTLC — not custody escrow.'
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
        Swap vault balance to BTC using a submarine atomic swap. Funds lock in Chia/Bitcoin HTLC
        smart contracts — PinkSurfing does not hold custody (not traditional escrow).
      </p>

      <div className="mb-2.5 rounded-[10px] border border-[#1E3A5F] bg-[#0D1220] p-3">
        <div className="mb-2 flex justify-between">
          <span className="text-[10px] text-[var(--ps-muted)]">Vault balance (USD*)</span>
          <span className="text-sm font-medium text-[var(--ps-white)]">
            ${vaultUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
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
          <li>XCH locks in a Chia HTLC smart contract (your KeyVault)</li>
          <li>Counterparty locks BTC in a matching Bitcoin HTLC</li>
          <li>Claim with preimage — atomic; either both settle or both refund</li>
          <li>No PinkSurfing escrow wallet — Raihan contracts use Chia on-chain logic</li>
        </ol>
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

      {status && (
        <p className="mb-2 text-[9px] text-[var(--ps-cyan)]">{status}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleInitiate}
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
    </div>
  );
}
