'use client';

import { CATEGORY_ACCENT } from '@/lib/profile-status-options';
import type { ProfileStatusCategory } from '@/lib/profile-status-options';

type PillProps = {
  label: string;
  accent?: string;
  /** Fill column width in mini profile stacks */
  block?: boolean;
};

/** Compact purple diamond pill — position, industry, location, status */
export function DiamondInfoPill({ label, accent, block }: PillProps) {
  return (
    <span
      className={`${block ? 'flex w-full' : 'inline-flex max-w-full'} items-center justify-center gap-0.5 rounded-full px-2 py-0.5 text-[7px] font-semibold leading-tight text-white`}
      style={{
        background: 'linear-gradient(135deg, #9747ff 0%, #7b2ff7 55%, #5a18d4 100%)',
        boxShadow: '0 1px 3px rgba(151, 71, 255, 0.3)',
      }}
    >
      <span className="shrink-0 text-[5px] opacity-75" aria-hidden>
        ◆
      </span>
      <span className="min-w-0 truncate" style={accent ? { color: accent } : undefined}>
        {label || '—'}
      </span>
      <span className="shrink-0 text-[5px] opacity-75" aria-hidden>
        ◆
      </span>
    </span>
  );
}

export type MiniProfileData = {
  name: string;
  avatarUrl: string;
  businessLogoUrl?: string;
  businessName?: string;
  position: string;
  industryLabel: string;
  location: string;
  statusMood: string;
  statusCategory: ProfileStatusCategory;
  aboutMe?: string;
  dealsInterestedIn?: string[];
};

type PanelProps = {
  person: MiniProfileData;
  onVisit?: () => void;
  footer?: React.ReactNode;
};

/** Mini profile — avatar left, business logo right, pills + about/deals in center */
export function ContactMiniProfilePanel({ person, onVisit, footer }: PanelProps) {
  const statusAccent = CATEGORY_ACCENT[person.statusCategory].color;
  const about =
    person.aboutMe?.trim() ||
    'Building on PinkSurfing — open to the right partnerships.';
  const deals = person.dealsInterestedIn?.length
    ? person.dealsInterestedIn
    : ['Referrals', 'Joint ventures'];

  return (
    <div className="shrink-0 border-b border-[var(--ps-brd)] bg-black px-2.5 py-2">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_minmax(54px,auto)] gap-x-2 gap-y-1">
        {/* Name sits above the pills row; avatar fills the pills row height */}
        <div className="col-start-2 row-start-1 truncate text-[11px] font-bold text-[var(--ps-white)]">
          {person.name}
        </div>

        <div className="col-start-1 row-start-2 h-full min-h-[54px] w-14 shrink-0 self-stretch overflow-hidden rounded-md border border-[var(--ps-brd)]">
          <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
        </div>

        <div className="col-start-2 row-start-2 flex min-h-[54px] items-stretch gap-1.5 pl-0.5">
          <div className="flex w-[44%] min-w-[96px] max-w-[130px] shrink-0 flex-col justify-between gap-0.5">
            <DiamondInfoPill block label={person.position} />
            <DiamondInfoPill block label={person.industryLabel} />
            <DiamondInfoPill block label={person.location} />
            <DiamondInfoPill block label={person.statusMood} accent={statusAccent} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-between gap-0.5">
            <div className="rounded-md border border-[var(--ps-brd)]/60 bg-[var(--ps-card)]/80 px-1.5 py-0.5">
              <div className="text-[6px] font-semibold uppercase tracking-wide text-[var(--ps-dim)]">
                About me
              </div>
              <p className="line-clamp-1 text-[7px] leading-snug text-[var(--ps-muted)]">
                {about}
              </p>
            </div>
            <div className="flex flex-1 flex-col rounded-md border border-[var(--ps-brd)]/60 bg-[var(--ps-card)]/80 px-1.5 py-0.5">
              <div className="text-[6px] font-semibold uppercase tracking-wide text-[var(--ps-dim)]">
                Deals interested in
              </div>
              <p className="line-clamp-2 text-[7px] leading-snug text-[var(--ps-muted)]">
                {deals.join(' · ')}
              </p>
            </div>
          </div>
        </div>

        <div className="col-start-3 row-span-2 row-start-1 flex shrink-0 flex-col items-end justify-between self-stretch">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-[var(--ps-brd)] bg-white px-0.5">
            {person.businessLogoUrl ? (
              <img
                src={person.businessLogoUrl}
                alt=""
                className="max-h-[85%] max-w-[85%] object-contain"
              />
            ) : (
              <span className="text-[7px] font-bold uppercase text-gray-400">
                {(person.businessName ?? person.name).slice(0, 4)}
              </span>
            )}
          </div>
          {onVisit && (
            <button
              type="button"
              onClick={onVisit}
              className="rounded-md bg-[#4a90d9] px-1.5 py-1 text-[7px] font-bold text-white shadow-md hover:bg-[#3a7bc8]"
            >
              Visit
            </button>
          )}
        </div>
      </div>

      {footer}
    </div>
  );
}
