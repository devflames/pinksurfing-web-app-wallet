'use client';

import { useState } from 'react';
import type { SettlementMode } from '@/lib/types/contract';

type Props = {
  open: boolean;
  conversationId: string;
  counterpartyUserId: string;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    scopeText: string;
    priceAmount?: number;
    deadlineAt?: string;
    settlementMode: SettlementMode;
  }) => Promise<void>;
};

export function CreateContractModal({
  open,
  conversationId,
  counterpartyUserId,
  onClose,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState('');
  const [scopeText, setScopeText] = useState('');
  const [price, setPrice] = useState('');
  const [deadline, setDeadline] = useState('');
  const [settlementMode, setSettlementMode] = useState<SettlementMode>('SQUARE');
  const [legalAgreed, setLegalAgreed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scopeText.trim()) {
      setError('Scope is required');
      return;
    }
    if (!legalAgreed) {
      setError('You must agree to create an executable contract');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim() || 'Contract',
        scopeText: scopeText.trim(),
        priceAmount: price ? Number(price) : undefined,
        deadlineAt: deadline ? new Date(deadline).toISOString() : undefined,
        settlementMode,
      });
      setTitle('');
      setScopeText('');
      setPrice('');
      setDeadline('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contract');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-20 flex items-end justify-center rounded-xl bg-[#0B001070]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[82%] w-full overflow-y-auto rounded-t-2xl bg-[var(--ps-card)] p-4"
      >
        <div className="mx-auto mb-3 h-0.5 w-8 rounded bg-white/15" />
        <div className="mb-3 flex items-center gap-2">
          <span className="text-base text-[var(--ps-pink)]">⚡</span>
          <h2 className="text-sm font-medium text-[var(--ps-white)]">Create Contract</h2>
        </div>
        <p className="mb-3 text-[10px] text-[var(--ps-dim)]">
          Conversation {conversationId} · counterparty {counterpartyUserId}
        </p>

        <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Title</label>
        <input
          className="mb-2 w-full rounded-md border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2.5 py-1.5 text-[11px] text-[var(--ps-white)] outline-none focus:border-[var(--ps-brd2)]"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Paint exterior"
        />

        <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Scope *</label>
        <textarea
          className="mb-2 w-full rounded-md border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2.5 py-1.5 text-[11px] text-[var(--ps-white)] outline-none focus:border-[var(--ps-brd2)]"
          rows={3}
          value={scopeText}
          onChange={(e) => setScopeText(e.target.value)}
          placeholder="Describe the work..."
          required
        />

        <div className="mb-2 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Price (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-md border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2.5 py-1.5 text-[11px] text-[var(--ps-white)] outline-none"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Deadline</label>
            <input
              type="date"
              className="w-full rounded-md border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2.5 py-1.5 text-[11px] text-[var(--ps-white)] outline-none"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Settlement</label>
        <select
          className="mb-3 w-full rounded-md border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2.5 py-1.5 text-[11px] text-[var(--ps-white)] outline-none"
          value={settlementMode}
          onChange={(e) => setSettlementMode(e.target.value as SettlementMode)}
        >
          <option value="SQUARE">Square (card / bank)</option>
          <option value="BTC_SWAP">Convert to Bitcoin</option>
          <option value="OFF_PLATFORM">Off-platform (wire / manual)</option>
          <option value="ESCROW">Vault (KeyVault escrow)</option>
        </select>

        <label className="mb-3 flex items-start gap-2 text-[10px] leading-relaxed text-[var(--ps-muted)]">
          <input
            type="checkbox"
            checked={legalAgreed}
            onChange={(e) => setLegalAgreed(e.target.checked)}
            className="mt-0.5"
          />
          I agree this creates an executable, timestamped contract. PinkSurfing does not enforce
          this agreement.
        </label>

        {error && <p className="mb-2 text-[10px] text-[var(--ps-red)]">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-[var(--ps-pink)] py-2 text-xs font-semibold text-[var(--ps-card)] disabled:opacity-60"
        >
          {busy ? 'Creating…' : 'I Agree — Create Contract'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-1.5 w-full rounded-lg border border-[var(--ps-brd)] py-2 text-[11px] text-[var(--ps-muted)]"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
