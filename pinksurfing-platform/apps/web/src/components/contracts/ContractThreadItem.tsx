'use client';

import type { BusinessContract, ContractActionType } from '@/lib/types/contract';
import { contractId } from '@/lib/types/contract';
import { ContractCompactCard } from '@/components/contracts/ContractCompactCard';
import { ContractCard } from '@/components/contracts/ContractCard';

type Props = {
  contract: BusinessContract;
  expanded: boolean;
  acting?: boolean;
  onToggle: (id: string) => void;
  onAction?: (action: ContractActionType) => void;
  onOpenSwap?: () => void;
};

export function ContractThreadItem({
  contract,
  expanded,
  acting,
  onToggle,
  onAction,
  onOpenSwap,
}: Props) {
  const id = contractId(contract);

  if (!expanded) {
    return (
      <ContractCompactCard
        contract={contract}
        active={false}
        onExpand={() => onToggle(id)}
      />
    );
  }

  return (
    <div className="mb-2">
      <ContractCard
        contract={contract}
        acting={acting}
        onAction={onAction}
        onOpenSwap={onOpenSwap}
        showTimeline
      />
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="mt-1 text-[9px] text-[var(--ps-dim)] hover:text-[var(--ps-muted)]"
      >
        Collapse
      </button>
    </div>
  );
}
