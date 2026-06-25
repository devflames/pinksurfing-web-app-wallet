'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createContractPaymentLink, fetchContractById } from '@/lib/contracts-api';
import type { BusinessContract } from '@/lib/types/contract';
import { contractId } from '@/lib/types/contract';
import { formatMoney } from '@/lib/contract-utils';

type Props = {
  open: boolean;
  contract: BusinessContract | null;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
};

type Phase = 'loading' | 'ready' | 'polling' | 'error';

const POLL_MS = 3000;

export function ContractSquareCheckoutModal({
  open,
  contract,
  token,
  onClose,
  onSuccess,
}: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const successRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const checkFunded = useCallback(async (): Promise<boolean> => {
    if (!contract) return false;
    const updated = await fetchContractById(token, contractId(contract));
    if (updated.state === 'ESCROW_FUNDED' || updated.state === 'IN_PROGRESS') {
      successRef.current = true;
      stopPolling();
      onSuccess();
      return true;
    }
    return false;
  }, [contract, onSuccess, stopPolling, token]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setPhase('polling');
    void checkFunded();
    pollRef.current = setInterval(() => {
      void checkFunded().catch(() => {});
    }, POLL_MS);
  }, [checkFunded]);

  const loadSquare = useCallback(async () => {
    if (!contract) return;
    setPhase('loading');
    setError(null);
    const funded = await checkFunded();
    if (funded) return;
    const url = await createContractPaymentLink(token, contractId(contract));
    setPaymentUrl(url);
    setPhase('ready');
  }, [checkFunded, contract, token]);

  useEffect(() => {
    if (!open) {
      stopPolling();
      setPhase('loading');
      setError(null);
      setPaymentUrl(null);
      successRef.current = false;
      return;
    }

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
  }, [loadSquare, open, stopPolling]);

  if (!open || !contract) return null;

  const amount = formatMoney(contract.priceAmount, contract.priceCurrency);

  return (
    <div
      className="absolute inset-0 z-20 flex items-end justify-center rounded-xl bg-[#0B001070]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[82%] w-full overflow-y-auto rounded-t-2xl bg-[var(--ps-card)] p-4">
        <div className="mx-auto mb-3.5 h-1 w-8 rounded bg-white/15" />
        <div className="mb-3.5 flex items-center gap-2">
          <span className="text-lg text-[var(--ps-cyan)]">💳</span>
          <span className="text-sm font-medium text-[var(--ps-white)]">Pay with Square</span>
        </div>

        <div className="mb-3.5 rounded-lg border border-[#6EE7FF25] bg-[#6EE7FF08] p-2.5">
          <div className="text-[11px] text-[var(--ps-muted)]">Contract escrow</div>
          <div className="text-[13px] font-medium text-[var(--ps-white)]">{contract.title}</div>
          <div className="mt-1 text-lg font-semibold text-[var(--ps-white)]">{amount}</div>
        </div>

        {phase === 'loading' && (
          <p className="mb-3 text-[11px] text-[var(--ps-muted)]">Preparing Square checkout…</p>
        )}

        {phase === 'error' && (
          <p className="mb-3 text-[11px] text-[var(--ps-red)]">{error}</p>
        )}

        {phase === 'ready' && paymentUrl && (
          <>
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 block w-full rounded-lg bg-[var(--ps-pink)] py-2.5 text-center text-xs font-semibold text-[var(--ps-card)]"
            >
              Open Square checkout · {amount}
            </a>
            <button
              type="button"
              onClick={startPolling}
              className="mb-2 w-full rounded-lg border border-[var(--ps-cyan)]/40 py-2 text-[11px] text-[var(--ps-cyan)]"
            >
              I completed payment
            </button>
          </>
        )}

        {phase === 'polling' && (
          <p className="mb-3 text-[11px] text-[var(--ps-muted)]">
            Waiting for payment confirmation…
          </p>
        )}

        <p className="mb-3 flex items-center gap-1.5 text-[9px] text-[var(--ps-muted)]">
          <span className="text-[var(--ps-green,#5DCAA5)]">🛡</span>
          Payments processed by Square · PinkSurfing does not store card data
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg border border-[var(--ps-brd)] py-2 text-[11px] text-[var(--ps-muted)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
