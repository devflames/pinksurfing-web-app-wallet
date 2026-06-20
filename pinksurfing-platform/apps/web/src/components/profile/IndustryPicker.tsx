'use client';

import {
  ALL_CATEGORIES,
  ALL_INDUSTRIES,
  industriesForCategory,
  industryCategoryNames,
} from '@/lib/industry-taxonomy';

type Props = {
  industryCategory: string;
  industry: string;
  onChange: (next: { industryCategory: string; industry: string }) => void;
  allowAll?: boolean;
  className?: string;
};

/** Profile / settings — pick category then specific industry */
export function IndustryPicker({
  industryCategory,
  industry,
  onChange,
  allowAll = false,
  className = '',
}: Props) {
  const categories = allowAll
    ? industryCategoryNames()
    : industryCategoryNames().filter((c) => c !== ALL_CATEGORIES);
  const industries = industriesForCategory(
    allowAll ? industryCategory : industryCategory || categories[0] || ALL_CATEGORIES
  ).filter((i) => allowAll || i !== ALL_INDUSTRIES);

  return (
    <div className={`grid gap-2 sm:grid-cols-2 ${className}`}>
      <div>
        <label className="mb-1 block text-[9px] text-[var(--ps-dim)]">Industry category</label>
        <select
          value={industryCategory}
          onChange={(e) => {
            const nextCat = e.target.value;
            onChange({
              industryCategory: nextCat,
              industry: allowAll ? ALL_INDUSTRIES : industriesForCategory(nextCat)[1] ?? '',
            });
          }}
          className="w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)] px-2 py-2 text-[10px] text-[var(--ps-white)] outline-none"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === ALL_CATEGORIES ? 'All categories' : c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[9px] text-[var(--ps-dim)]">Specific industry</label>
        <select
          value={industry}
          onChange={(e) => onChange({ industryCategory, industry: e.target.value })}
          className="w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)] px-2 py-2 text-[10px] text-[var(--ps-white)] outline-none"
        >
          {(allowAll ? industries : industries.filter((i) => i !== ALL_INDUSTRIES)).map((i) => (
            <option key={i} value={i}>
              {i === ALL_INDUSTRIES ? 'All industries' : i}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function formatIndustryLabel(category: string, industry: string): string {
  if (!category || category === ALL_CATEGORIES) return industry;
  return `${category} · ${industry}`;
}
