'use client';

import { useState } from 'react';
import { FindFiltersPanel } from '@/components/contacts/FindFiltersPanel';
import type { DiscoverFilters } from '@/lib/discover-people';

type Props = {
  filters: DiscoverFilters;
  onChange: (patch: Partial<DiscoverFilters>) => void;
  states?: string[];
  /** Left label in the toolbar row */
  label?: string;
  /** Center content — counts, badges, etc. */
  meta?: React.ReactNode;
  /** Extra controls after the sort toggle (e.g. Undo) */
  trailing?: React.ReactNode;
  /** Hint line below the toolbar (always visible) */
  hint?: string;
  toggleLabel?: string;
  defaultOpen?: boolean;
};

/** Compact toolbar — tap to reveal full location + industry filters below */
export function CollapsibleFiltersPanel({
  filters,
  onChange,
  states,
  label,
  meta,
  trailing,
  hint,
  toggleLabel = 'Sort / filter',
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--ps-brd)] bg-[var(--ps-surf)] px-3 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {label ? (
            <span className="shrink-0 text-[9px] text-[var(--ps-dim)]">{label}</span>
          ) : null}
          {meta}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className={`flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] transition-colors ${
              open
                ? 'bg-[#9747ff]/20 text-[#9747ff]'
                : 'text-[var(--ps-dim)] hover:text-[var(--ps-muted)]'
            }`}
          >
            {toggleLabel}
            <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {trailing}
        </div>
      </div>

      {open && <FindFiltersPanel filters={filters} onChange={onChange} states={states} />}

      {hint ? (
        <div className="border-b border-[var(--ps-brd)] px-3 py-1 text-[8px] text-[var(--ps-dim)]">
          {hint}
        </div>
      ) : null}
    </>
  );
}
