'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useWalletAuth } from '@/hooks/use-wallet-auth';
import { useWalletIdentity } from '@/hooks/use-wallet-identity';
import {
  acceptAtomicSwap,
  cancelAtomicSwap,
  claimAtomicSwap,
  completeAtomicSwap,
  refundAtomicSwap,
  updateSwapChiaHtlc,
  type AcceptSwapPayload,
} from '@/lib/wallet-api';
import type { AtomicSwap } from '@/lib/types/wallet';
import { getSwapSecret } from '@/lib/swap-secrets-storage';

type Props = {
  swap: AtomicSwap;
  onUpdated?: () => void;
};

export function SwapActionsPanel({ swap, onUpdated }: Props) {
  const { user } = useAuth();
  const { auth, ready } = useWalletAuth();
  const { chiaAddress } = useWalletIdentity();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAccept, setShowAccept] = useState(false);
  const [showHtlc, setShowHtlc] = useState(false);
  const [acceptForm, setAcceptForm] = useState<AcceptSwapPayload>({
    counterpartyChiaAddress: chiaAddress.trim(),
  });
  const [htlcForm, setHtlcForm] = useState({ puzzleHash: '', address: '', coinId: '' });

  const isInitiator = chiaAddress.trim() === swap.initiatorChiaAddress;
  const secret = user?.email ? getSwapSecret(user.email, swap.id) : null;

  const run = async (action: () => Promise<unknown>) => {
    if (!ready || !auth) {
      setError('Restore wallet to sign swap actions.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await action();
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1.5 space-y-1.5 border-t border-[var(--ps-brd)] pt-1.5">
      {secret && (
        <p className="break-all text-[8px] text-[var(--ps-dim)]" title={secret}>
          Preimage stored locally (keep safe)
        </p>
      )}
      <div className="flex flex-wrap gap-1">
        {swap.status === 'created' && isInitiator && (
          <ActionBtn
            label="Cancel"
            disabled={busy}
            onClick={() => run(() => cancelAtomicSwap(swap.id, auth!))}
          />
        )}
        {swap.status === 'created' && !isInitiator && (
          <ActionBtn label="Accept" disabled={busy} onClick={() => setShowAccept((v) => !v)} />
        )}
        {['accepted', 'claimed'].includes(swap.status) && (
          <>
            <ActionBtn
              label="Claim"
              disabled={busy}
              onClick={() => run(() => claimAtomicSwap(swap.id, auth!))}
            />
            <ActionBtn
              label="Complete"
              disabled={busy}
              onClick={() => run(() => completeAtomicSwap(swap.id, auth!))}
            />
            <ActionBtn
              label="Refund"
              disabled={busy}
              onClick={() => run(() => refundAtomicSwap(swap.id, auth!))}
            />
          </>
        )}
        {isInitiator && swap.status !== 'cancelled' && swap.status !== 'completed' && (
          <ActionBtn
            label={showHtlc ? 'Hide Chia HTLC' : 'Record Chia HTLC'}
            disabled={busy}
            onClick={() => setShowHtlc((v) => !v)}
          />
        )}
      </div>

      {showAccept && (
        <div className="space-y-1 rounded border border-[var(--ps-brd)] p-2">
          <MiniField
            label="Your Chia address"
            value={acceptForm.counterpartyChiaAddress}
            onChange={(v) => setAcceptForm((f) => ({ ...f, counterpartyChiaAddress: v }))}
          />
          <MiniField
            label="BTC HTLC address"
            value={acceptForm.btcHtlcAddress ?? ''}
            onChange={(v) => setAcceptForm((f) => ({ ...f, btcHtlcAddress: v }))}
          />
          <MiniField
            label="BTC redeem script (hex)"
            value={acceptForm.btcHtlcRedeemScript ?? ''}
            onChange={(v) => setAcceptForm((f) => ({ ...f, btcHtlcRedeemScript: v }))}
          />
          <MiniField
            label="BTC funding txid"
            value={acceptForm.btcHtlcFundingTxid ?? ''}
            onChange={(v) => setAcceptForm((f) => ({ ...f, btcHtlcFundingTxid: v }))}
          />
          <ActionBtn
            label="Submit accept"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await acceptAtomicSwap(swap.id, acceptForm, auth!);
                setShowAccept(false);
              })
            }
          />
        </div>
      )}

      {showHtlc && (
        <div className="space-y-1 rounded border border-[var(--ps-brd)] p-2">
          <MiniField
            label="Chia HTLC puzzle hash"
            value={htlcForm.puzzleHash}
            onChange={(v) => setHtlcForm((f) => ({ ...f, puzzleHash: v }))}
          />
          <MiniField
            label="Chia HTLC address"
            value={htlcForm.address}
            onChange={(v) => setHtlcForm((f) => ({ ...f, address: v }))}
          />
          <MiniField
            label="Chia coin id"
            value={htlcForm.coinId}
            onChange={(v) => setHtlcForm((f) => ({ ...f, coinId: v }))}
          />
          <ActionBtn
            label="Save Chia HTLC"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await updateSwapChiaHtlc(swap.id, htlcForm);
                setHtlcForm({ puzzleHash: '', address: '', coinId: '' });
              })
            }
          />
        </div>
      )}

      {error && <p className="text-[8px] text-[var(--ps-red,#f87171)]">{error}</p>}
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-[var(--ps-brd)] px-2 py-0.5 text-[8px] text-[var(--ps-cyan)] disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function MiniField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[8px] text-[var(--ps-dim)]">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-[var(--ps-brd)] bg-white/5 px-1.5 py-1 text-[8px] text-[var(--ps-white)]"
      />
    </div>
  );
}
