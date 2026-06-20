'use client';

type Props = {
  contractCount: number;
  onOpenContracts: () => void;
};

export function ExecBar({ contractCount, onOpenContracts }: Props) {
  return (
    <button
      type="button"
      onClick={onOpenContracts}
      className="flex w-full shrink-0 items-center gap-2 border-t border-[var(--ps-brd)] bg-[#12001C] px-3 py-2 text-left hover:bg-[var(--ps-card)]"
    >
      <span className="text-sm text-[var(--ps-pink)]">⚡</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--ps-white)]">
          Execute Contracts
          {contractCount > 0 && (
            <span className="rounded-full bg-[var(--ps-pink)] px-1.5 text-[8px] font-bold text-[var(--ps-card)]">
              {contractCount}
            </span>
          )}
        </div>
        <div className="text-[9px] text-[var(--ps-dim)]">Create or view active contracts</div>
      </div>
      <span className="text-[var(--ps-dim)]">›</span>
    </button>
  );
}
