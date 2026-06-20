'use client';

import type { BusinessContract, ContractActionType } from '@/lib/types/contract';
import { STATE_COLORS, STATE_LABELS, actionsForState, formatDate, formatMoney } from '@/lib/contract-utils';
import { contractId } from '@/lib/types/contract';

type Props = {
  contract: BusinessContract;
  onAction?: (action: ContractActionType) => void;
  acting?: boolean;
  compact?: boolean;
  onOpenSwap?: () => void;
};

export function ContractCard({ contract, onAction, acting, compact, onOpenSwap }: Props) {
  const colors = STATE_COLORS[contract.state] ?? STATE_COLORS.DRAFT;
  const actions = onAction ? actionsForState(contract.state, contract.settlementMode) : [];

  return (
    <div className="my-1 overflow-hidden rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)]">
      <div
        className="flex items-center gap-1.5 border-b px-2.5 py-1.5"
        style={{
          borderColor: `${colors.text}40`,
          background: `${colors.bg}`,
        }}
      >
        <span className="text-[13px]" style={{ color: colors.text }}>
          ⚡
        </span>
        <span className="flex-1 text-[10px] font-medium" style={{ color: colors.text }}>
          {STATE_LABELS[contract.state]}
        </span>
        <span
          className="rounded border px-1 text-[8px] font-bold"
          style={{ color: colors.text, borderColor: colors.border, background: colors.bg }}
        >
          {contract.state.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="px-2.5 py-2">
        <div className="text-xs font-medium text-[var(--ps-white)]">{contract.title}</div>
        {!compact && (
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--ps-muted)]">{contract.scopeText}</p>
        )}
        <div className="mt-1 text-base font-semibold text-[var(--ps-white)]">
          {formatMoney(contract.priceAmount, contract.priceCurrency)}
        </div>
        <div className="text-[10px] text-[var(--ps-muted)]">
          Deadline {formatDate(contract.deadlineAt)} · {contract.settlementMode.replace(/_/g, ' ')}
          {contract.settlementMode === 'SQUARE' && (
            <span className="ml-1 rounded border border-[#6EE7FF40] bg-[#6EE7FF15] px-1 text-[8px] text-[var(--ps-cyan)]">
              Square
            </span>
          )}
          {contract.settlementMode === 'BTC_SWAP' && (
            <span className="ml-1 rounded border border-[#F7931A40] bg-[#F7931A15] px-1 text-[8px] text-[#F7931A]">
              BTC Swap
            </span>
          )}
        </div>
        {actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {actions.map(({ action, label }) => (
              <button
                key={action}
                type="button"
                disabled={acting}
                onClick={() => onAction?.(action)}
                className="rounded-md border border-[var(--ps-brd2)] bg-[var(--ps-surf)] px-2 py-0.5 text-[9px] font-medium text-[var(--ps-white)] hover:border-[var(--ps-pink)] disabled:opacity-50"
              >
                {label}
              </button>
            ))}
            {onOpenSwap &&
              (contract.settlementMode === 'BTC_SWAP' ||
                ['ESCROW_FUNDED', 'IN_PROGRESS', 'PAID_OFF_PLATFORM'].includes(contract.state)) && (
                <button
                  type="button"
                  onClick={onOpenSwap}
                  className="rounded-md border border-[#F7931A50] bg-[#F7931A15] px-2 py-0.5 text-[9px] font-medium text-[#F7931A]"
                >
                  ₿ Convert to BTC
                </button>
              )}
          </div>
        )}
        <div className="mt-1 text-[9px] text-[var(--ps-dim)]">ID {contractId(contract).slice(-8)}</div>
      </div>
    </div>
  );
}
