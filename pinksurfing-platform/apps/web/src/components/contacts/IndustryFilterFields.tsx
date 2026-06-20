'use client';

import type { DiscoverFilters } from '@/lib/discover-people';
import {
  ALL_CATEGORIES,
  ALL_INDUSTRIES,
  industriesForCategory,
  industryCategoryNames,
} from '@/lib/industry-taxonomy';

type Props = {
  filters: Pick<DiscoverFilters, 'industryCategory' | 'industry'>;
  onChange: (patch: Partial<DiscoverFilters>) => void;
  compact?: boolean;
};

/** Two-step industry filter — category then specific industry */
export function IndustryFilterFields({ filters, onChange, compact }: Props) {
  const categories = industryCategoryNames();
  const industries = industriesForCategory(filters.industryCategory);

  const selectClass = compact
    ? 'max-w-[130px] rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)] px-2 py-1 text-[9px] text-[var(--ps-white)] outline-none'
    : 'w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)] px-2 py-1.5 text-[10px] text-[var(--ps-white)] outline-none';

  return (
    <>
      <div>
        <label className="mb-0.5 block text-[7px] text-[var(--ps-dim)]">Category</label>
        <select
          value={filters.industryCategory}
          onChange={(e) => {
            const industryCategory = e.target.value;
            onChange({
              industryCategory,
              industry: ALL_INDUSTRIES,
            });
          }}
          className={selectClass}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === ALL_CATEGORIES ? 'All categories' : c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-0.5 block text-[7px] text-[var(--ps-dim)]">Industry</label>
        <select
          value={filters.industry}
          onChange={(e) => onChange({ industry: e.target.value })}
          className={selectClass}
        >
          {industries.map((i) => (
            <option key={i} value={i}>
              {i === ALL_INDUSTRIES ? 'All industries' : i}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
