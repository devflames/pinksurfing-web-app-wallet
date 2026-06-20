'use client';

import type { DiscoverFilters } from '@/lib/discover-people';
import { discoverStates, RADIUS_OPTIONS_MI } from '@/lib/discover-people';
import { IndustryFilterFields } from '@/components/contacts/IndustryFilterFields';

type Props = {
  filters: DiscoverFilters;
  onChange: (patch: Partial<DiscoverFilters>) => void;
  states?: string[];
};

export function FindFiltersPanel({ filters, onChange, states: statesProp }: Props) {
  const states = statesProp ?? discoverStates();

  return (
    <div className="shrink-0 border-b border-[var(--ps-brd)] bg-[var(--ps-surf)] px-3 py-2">
      <div className="mb-1.5 text-[8px] font-semibold uppercase tracking-wide text-[var(--ps-dim)]">
        Filters
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-0.5 block text-[7px] text-[var(--ps-dim)]">Location</label>
          <div className="flex rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)] p-0.5">
            {(['state', 'radius'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onChange({ locationMode: mode })}
                className={`rounded-md px-2 py-0.5 text-[8px] font-medium transition-colors ${
                  filters.locationMode === mode
                    ? 'bg-[var(--ps-pink)]/25 text-[var(--ps-pink)]'
                    : 'text-[var(--ps-dim)]'
                }`}
              >
                {mode === 'state' ? 'State' : 'Radius'}
              </button>
            ))}
          </div>
        </div>

        {filters.locationMode === 'state' ? (
          <div>
            <label className="mb-0.5 block text-[7px] text-[var(--ps-dim)]">State</label>
            <select
              value={filters.state}
              onChange={(e) => onChange({ state: e.target.value })}
              className="rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)] px-2 py-1 text-[9px] text-[var(--ps-white)] outline-none"
            >
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-0.5 block text-[7px] text-[var(--ps-dim)]">Your ZIP</label>
              <input
                value={filters.zip}
                onChange={(e) => onChange({ zip: e.target.value })}
                placeholder="78701"
                maxLength={5}
                className="w-16 rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)] px-2 py-1 text-[9px] text-[var(--ps-white)] outline-none"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[7px] text-[var(--ps-dim)]">Within</label>
              <select
                value={filters.radiusMi}
                onChange={(e) => onChange({ radiusMi: Number(e.target.value) })}
                className="rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)] px-2 py-1 text-[9px] text-[var(--ps-white)] outline-none"
              >
                {RADIUS_OPTIONS_MI.map((mi) => (
                  <option key={mi} value={mi}>
                    {mi} mi
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <IndustryFilterFields filters={filters} onChange={onChange} compact />
      </div>
    </div>
  );
}
