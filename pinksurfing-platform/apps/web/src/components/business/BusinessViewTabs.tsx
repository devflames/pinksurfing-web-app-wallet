'use client';

import type { BusinessView } from '@/lib/business-view';
import { BUSINESS_VIEWS } from '@/lib/business-view';

type Props = {
  active: BusinessView;
  onChange: (view: BusinessView) => void;
};

export function BusinessViewTabs({ active, onChange }: Props) {
  return (
    <div className="flex shrink-0 border-b border-[var(--ps-brd)] bg-[var(--ps-surf)]">
      {BUSINESS_VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onChange(v.id)}
          className={`flex-1 border-b-2 py-1.5 text-[10px] transition-colors ${
            active === v.id
              ? 'border-[var(--ps-pink)] text-[var(--ps-pink)]'
              : 'border-transparent text-[var(--ps-dim)] hover:text-[var(--ps-muted)]'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
