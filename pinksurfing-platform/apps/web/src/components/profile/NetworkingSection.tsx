'use client';

import { useMemo, useState } from 'react';
import { CollapsibleFiltersPanel } from '@/components/contacts/CollapsibleFiltersPanel';
import {
  defaultDiscoverFilters,
  filterByDiscoverFilters,
  loadFindZip,
  saveFindZip,
  statesFromPeople,
  type DiscoverFilters,
} from '@/lib/discover-people';
import { DEMO_NETWORK } from '@/lib/profile-data';

function NetworkGrid({ people }: { people: typeof DEMO_NETWORK }) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-4">
      {people.map((p) => (
        <div key={p.id} className="text-center">
          <div className="mx-auto mb-1 aspect-square w-full max-w-[56px] overflow-hidden rounded-xl border border-[var(--ps-brd)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="truncate text-[9px] text-[var(--ps-white)]">{p.name}</div>
        </div>
      ))}
    </div>
  );
}

type Props = {
  filterEmail?: string;
};

export function NetworkingSection({ filterEmail = 'guest' }: Props) {
  const [filters, setFilters] = useState<DiscoverFilters>(() =>
    defaultDiscoverFilters(loadFindZip(filterEmail))
  );

  const networkStates = useMemo(() => statesFromPeople(DEMO_NETWORK), []);

  const filteredFirst = useMemo(
    () => filterByDiscoverFilters(DEMO_NETWORK.filter((n) => n.line === 'first'), filters),
    [filters]
  );

  const filteredSecond = useMemo(
    () => filterByDiscoverFilters(DEMO_NETWORK.filter((n) => n.line === 'second'), filters),
    [filters]
  );

  const patchFilters = (patch: Partial<DiscoverFilters>) => {
    setFilters((f) => {
      const next = { ...f, ...patch };
      if (patch.zip != null) saveFindZip(filterEmail, patch.zip);
      return next;
    });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)]">
      <div className="border-b border-[var(--ps-brd)] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ps-muted)]">
        Networking
      </div>
      <CollapsibleFiltersPanel
        filters={filters}
        onChange={patchFilters}
        states={networkStates}
        meta={
          <span className="text-[9px] text-[var(--ps-dim)]">
            {filteredFirst.length + filteredSecond.length} contacts
          </span>
        }
        hint="1st & 2nd line networking"
      />
      <div className="space-y-4 p-3">
        <div>
          <div className="mb-2 text-[10px] font-medium text-[var(--ps-cyan)]">
            1st line ({filteredFirst.length})
          </div>
          <NetworkGrid people={filteredFirst} />
        </div>
        <div>
          <div className="mb-2 text-[10px] font-medium text-[var(--ps-pink)]">
            2nd line ({filteredSecond.length})
          </div>
          <NetworkGrid people={filteredSecond} />
        </div>
      </div>
    </section>
  );
}
