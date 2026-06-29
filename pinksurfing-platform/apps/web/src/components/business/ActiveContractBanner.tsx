'use client';

import type { BusinessContract } from '@/lib/types/contract';
import { STATE_COLORS, STATE_LABELS, formatMoney } from '@/lib/contract-utils';

type Props = {
  contract: BusinessContract;
  onScrollToContract?: () => void;
};

/** Sticky banner — Jilani ContractChatBanner style, wired to our contract model. */
export function ActiveContractBanner({ contract, onScrollToContract }: Props) {
  if (['COMPLETED', 'CANCELLED', 'LAPSED'].includes(contract.state)) return null;

  const colors = STATE_COLORS[contract.state] ?? STATE_COLORS.DRAFT;

  return (
    <button
      type="button"
      onClick={onScrollToContract}
      className="flex w-full shrink-0 items-center gap-2 border-b px-4 py-2.5 text-left transition-colors hover:brightness-110"
      style={{
        borderColor: 'rgba(123,47,190,0.25)',
        background: 'linear-gradient(90deg, rgba(123,47,190,0.18), rgba(123,47,190,0.06))',
      }}
    >
      <span className="text-xs" style={{ color: colors.text }}>
        ⚡
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--ps-white)]">
        {contract.title}
      </span>
      <span className="shrink-0 text-[11px] text-[var(--ps-muted)]">
        {formatMoney(contract.priceAmount, contract.priceCurrency)}
        <span className="ml-1.5" style={{ color: colors.text }}>
          · {STATE_LABELS[contract.state]}
        </span>
      </span>
      <span className="text-[var(--ps-dim)]">›</span>
    </button>
  );
}
