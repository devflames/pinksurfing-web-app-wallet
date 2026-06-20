'use client';

import type { BusinessContract } from '@/lib/types/contract';
import { STATE_LABELS, formatMoney } from '@/lib/contract-utils';

type Props = {
  contract: BusinessContract;
  onScrollToContract?: () => void;
};

export function ActiveContractBanner({ contract, onScrollToContract }: Props) {
  if (['COMPLETED', 'CANCELLED'].includes(contract.state)) return null;

  return (
    <button
      type="button"
      onClick={onScrollToContract}
      className="flex w-full shrink-0 items-center gap-2 border-b border-[var(--ps-brd)] bg-[#210035] px-3 py-1.5 text-left hover:bg-[var(--ps-card2)]"
    >
      <span className="text-xs text-[var(--ps-pink)]">⚡</span>
      <span className="truncate text-[10px] font-medium text-[var(--ps-white)]">{contract.title}</span>
      <span className="flex-1 truncate text-[9px] text-[var(--ps-muted)]">
        {formatMoney(contract.priceAmount, contract.priceCurrency)} · {STATE_LABELS[contract.state]}
      </span>
      <span className="text-[var(--ps-dim)]">›</span>
    </button>
  );
}
