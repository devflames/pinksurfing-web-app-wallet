'use client';

import type { BusinessContract } from '@/lib/types/contract';
import { STATE_COLORS, STATE_LABELS, formatMoney } from '@/lib/contract-utils';

type Props = {
  contract: BusinessContract;
  onExpand: () => void;
  active?: boolean;
};

export function ContractCompactCard({ contract, onExpand, active }: Props) {
  const colors = STATE_COLORS[contract.state] ?? STATE_COLORS.DRAFT;

  return (
    <button
      type="button"
      onClick={onExpand}
      className={`mb-1 flex w-full max-w-[560px] items-center gap-2 rounded-lg border-l-[3px] px-3 py-2 text-left transition-colors hover:brightness-110 ${
        active ? 'ring-1 ring-[var(--ps-pink)]/40' : ''
      }`}
      style={{
        borderColor: `${colors.text}22`,
        borderLeftColor: colors.text,
        background: `${colors.bg}`,
      }}
    >
      <span className="shrink-0 text-[13px]" style={{ color: colors.text }}>
        ⚡
      </span>
      <span
        className="shrink-0 text-[11px] font-semibold"
        style={{ color: colors.text, minWidth: '4.5rem' }}
      >
        {STATE_LABELS[contract.state]}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--ps-white)]">
        {contract.title}
      </span>
      <span className="shrink-0 font-mono text-[11px] text-[var(--ps-dim)]">
        {formatMoney(contract.priceAmount, contract.priceCurrency)}
      </span>
      <span
        className="shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-wide"
        style={{ color: colors.text, borderColor: `${colors.text}44`, background: colors.bg }}
      >
        {contract.state.replace(/_/g, ' ')}
      </span>
      <span className="shrink-0 text-[11px] text-[var(--ps-dim)]">·</span>
    </button>
  );
}
