'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createPaychatPaymentLink,
  fetchPaychatRoomStatus,
  grantPaychatVaultUnlock,
} from '@/lib/chat-api';
import { formatXch } from '@/lib/wallet-api';
import { payPaychatViaVault } from '@/lib/paychat-vault-payment';

type PaymentMethod = 'square' | 'vault';

type Props = {
  open: boolean;
  name: string;
  amountUsd: number;
  token: string;
  fromUserId: string;
  toUserId: string;
  userEmail: string;
  recipientChiaAddress?: string | null;
  walletLive: boolean;
  onClose: () => void;
  onSuccess: (method: PaymentMethod) => void;
};

type Phase = 'loading' | 'ready' | 'polling' | 'vault-busy' | 'error';

const POLL_MS = 3000;

export function PayChatCheckoutModal({
  open,
  name,
  amountUsd,
  token,
  fromUserId,
  toUserId,
  userEmail,
  recipientChiaAddress,
  walletLive,
  onClose,
  onSuccess,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>('square');
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [displayAmount, setDisplayAmount] = useState(amountUsd);
  const [vaultAddress, setVaultAddress] = useState(recipientChiaAddress ?? '');
  const [vaultMojos, setVaultMojos] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const successRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const checkAccess = useCallback(async (): Promise<boolean> => {
    const status = await fetchPaychatRoomStatus(token, fromUserId, toUserId);
    setDisplayAmount(status.dialAskAmount || amountUsd);
    if (status.access) {
      successRef.current = true;
      stopPolling();
      onSuccess(method);
      return true;
    }
    return false;
  }, [amountUsd, fromUserId, method, onSuccess, stopPolling, toUserId, token]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setPhase('polling');
    void checkAccess();
    pollRef.current = setInterval(() => {
      void checkAccess().catch(() => {});
    }, POLL_MS);
  }, [checkAccess]);

  const loadSquare = useCallback(async () => {
    setPhase('loading');
    setError(null);
    const status = await fetchPaychatRoomStatus(token, fromUserId, toUserId);
    setDisplayAmount(status.dialAskAmount || amountUsd);
    if (status.access) {
      successRef.current = true;
      onSuccess('square');
      return;
    }
    const url = await createPaychatPaymentLink(token, fromUserId, toUserId);
    setPaymentUrl(url);
    setPhase('ready');
  }, [amountUsd, fromUserId, onSuccess, toUserId, token]);

  useEffect(() => {
    if (!open) {
      stopPolling();
      setPhase('loading');
      setError(null);
      setPaymentUrl(null);
      setMethod('square');
      successRef.current = false;
      setVaultAddress(recipientChiaAddress ?? '');
      return;
    }

    if (method !== 'square') return;

    let cancelled = false;
    loadSquare().catch((e) => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : 'Payment setup failed');
      setPhase('error');
    });

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [loadSquare, method, open, recipientChiaAddress, stopPolling]);

  useEffect(() => {
    if (!open) return;
    const onFocus = () => {
      if (phase === 'polling') void checkAccess().catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [checkAccess, open, phase]);

  const openSquare = () => {
    if (!paymentUrl) return;
    window.open(paymentUrl, '_blank', 'noopener,noreferrer');
    startPolling();
  };

  const payWithVault = async () => {
    const address = vaultAddress.trim();
    if (!address) {
      setError('Enter the recipient wallet address');
      return;
    }
    if (!walletLive) {
      setError('Vault payments require NEXT_PUBLIC_WALLET_LIVE=true');
      return;
    }
    setPhase('vault-busy');
    setError(null);
    try {
      const result = await payPaychatViaVault({
        email: userEmail,
        recipientAddress: address,
        amountUsd: displayAmount,
        memo: `PayChat unlock — ${name}`,
      });
      setVaultMojos(result.amountMojos);
      await grantPaychatVaultUnlock(token, fromUserId, toUserId, result.offerId);
      const unlocked = await checkAccess();
      if (!unlocked) {
        successRef.current = true;
        onSuccess('vault');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vault payment failed');
      setPhase('error');
    }
  };

  if (!open || successRef.current) return null;

  const amountLabel = `$${displayAmount.toFixed(2)}`;
  const vaultLabel = vaultMojos != null ? formatXch(vaultMojos) : null;

  return (
    <div
      className="ps-modal-backdrop absolute inset-0 z-20 flex items-end justify-center rounded-none bg-[#0B001070] md:rounded-xl"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ps-modal-sheet max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-[var(--ps-card)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:max-h-[82%]">
        <div className="mx-auto mb-3.5 h-1 w-8 rounded bg-white/15" />
        <div className="mb-3 text-sm font-medium text-[var(--ps-white)]">Unlock PayChat — {name}</div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMethod('square');
              setError(null);
            }}
            className={`rounded-lg border py-2 text-[11px] font-medium ${
              method === 'square'
                ? 'border-[var(--ps-pink)] bg-[var(--ps-pink)]/15 text-[var(--ps-pink)]'
                : 'border-[var(--ps-brd)] text-[var(--ps-muted)]'
            }`}
          >
            💳 Square
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod('vault');
              setPhase('ready');
              setError(null);
              stopPolling();
            }}
            className={`rounded-lg border py-2 text-[11px] font-medium ${
              method === 'vault'
                ? 'border-[var(--ps-cyan)] bg-[var(--ps-cyan)]/10 text-[var(--ps-cyan)]'
                : 'border-[var(--ps-brd)] text-[var(--ps-muted)]'
            }`}
          >
            🔐 Vault
          </button>
        </div>

        <div className="mb-3.5 rounded-lg border border-[#6EE7FF25] bg-[#6EE7FF08] p-2.5">
          <div className="text-[11px] text-[var(--ps-muted)]">One-time unlock fee</div>
          <div className="mt-1 text-lg font-semibold text-[var(--ps-white)]">{amountLabel}</div>
          {vaultLabel && (
            <div className="text-[10px] text-[var(--ps-cyan)]">Sent {vaultLabel} on-chain</div>
          )}
        </div>

        {method === 'square' && (
          <>
            {phase === 'loading' && (
              <p className="mb-3 text-center text-[11px] text-[var(--ps-muted)]">
                Preparing Square checkout…
              </p>
            )}
            {phase === 'polling' && (
              <p className="mb-3 text-center text-[11px] text-[var(--ps-cyan)]">
                Waiting for Square payment… complete checkout in the other tab.
              </p>
            )}
            <button
              type="button"
              disabled={phase === 'loading' || !paymentUrl}
              onClick={openSquare}
              className="w-full rounded-lg bg-[var(--ps-pink)] py-2.5 text-xs font-semibold text-[var(--ps-card)] disabled:opacity-50"
            >
              {phase === 'polling' ? 'Re-open Square checkout' : `Pay ${amountLabel} on Square`}
            </button>
            {phase === 'polling' && (
              <button
                type="button"
                onClick={() => void checkAccess().catch(() => setError('Payment not confirmed yet'))}
                className="mt-1.5 w-full rounded-lg border border-[var(--ps-brd)] py-2 text-[11px] text-[var(--ps-muted)]"
              >
                I&apos;ve completed payment
              </button>
            )}
          </>
        )}

        {method === 'vault' && (
          <>
            <p className="mb-2 text-[10px] text-[var(--ps-muted)]">
              Pay from your PinkSurfing wallet on-chain. Keys stay on your device.
            </p>
            <label className="mb-1 block text-[10px] text-[var(--ps-muted)]">
              Recipient wallet address
            </label>
            <input
              value={vaultAddress}
              onChange={(e) => setVaultAddress(e.target.value)}
              placeholder="xch1…"
              className="mb-3 w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-3 py-2 text-[11px] text-[var(--ps-white)] outline-none"
            />
            <button
              type="button"
              disabled={phase === 'vault-busy'}
              onClick={() => void payWithVault()}
              className="w-full rounded-lg bg-[var(--ps-cyan)] py-2.5 text-xs font-semibold text-[var(--ps-card)] disabled:opacity-50"
            >
              {phase === 'vault-busy' ? 'Signing & broadcasting…' : `Pay via vault · ${amountLabel}`}
            </button>
            <p className="mt-2 text-[9px] text-[var(--ps-dim)]">
              Square unlocks chat on the server instantly. Vault sends XCH on-chain and unlocks
              PayChat on the server after payment.
            </p>
          </>
        )}

        {phase === 'error' && error && (
          <p className="mb-3 mt-2 rounded-lg border border-[var(--ps-pink)]/30 bg-[var(--ps-pink)]/10 px-3 py-2 text-[11px] text-[var(--ps-pink)]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-1.5 w-full rounded-lg border border-[var(--ps-brd)] py-2 text-[11px] text-[var(--ps-muted)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
