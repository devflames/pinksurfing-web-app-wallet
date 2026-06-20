'use client';

import { DEMO_TEAM, type TeamMember } from '@/lib/profile-data';
import { useShellNav } from '@/lib/shell-nav-context';

function MemberCell({ member }: { member: TeamMember }) {
  return (
    <div className="relative text-center">
      <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--ps-pink)]/40 bg-[var(--ps-card2)] text-[11px] font-medium text-[var(--ps-pink)]">
        {member.name.slice(0, 2).toUpperCase()}
      </div>
      {member.vip && (
        <span className="absolute right-0 top-0 rounded bg-[var(--ps-amber)] px-1 text-[7px] font-bold text-[var(--ps-bg)]">
          VIP
        </span>
      )}
      <div className="truncate text-[9px] text-[var(--ps-white)]">{member.name}</div>
      <div className="text-[8px] text-[var(--ps-dim)]">{member.role}</div>
    </div>
  );
}

export function TeamsSection() {
  const { showToast, navigate } = useShellNav();

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)]">
      <div className="flex items-center justify-between border-b border-[var(--ps-brd)] px-3 py-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--ps-muted)]">
          Edit Teams
        </span>
        <button
          type="button"
          onClick={() => showToast('Team member invite sent (demo)')}
          className="rounded-md border border-[var(--ps-brd)] px-2 py-0.5 text-[9px] text-[var(--ps-cyan)] hover:bg-[var(--ps-cyan)]/10"
        >
          + Add
        </button>
      </div>
      <div className="p-3">
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => showToast('Team logo picker (demo)')}
            className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-[var(--ps-brd2)] text-[9px] text-[var(--ps-dim)] hover:border-[var(--ps-cyan)]/40 hover:text-[var(--ps-cyan)]"
          >
            Logo
          </button>
          <div className="flex flex-1 gap-2">
            <button
              type="button"
              onClick={() => showToast('Upload team logo (demo)')}
              className="flex-1 rounded-lg border border-[var(--ps-brd)] py-1.5 text-[9px] text-[var(--ps-muted)] hover:text-[var(--ps-white)]"
            >
              Change Team logo
            </button>
            <button
              type="button"
              onClick={() => navigate('explore', { exploreScreen: 'gigs' })}
              className="flex-1 rounded-lg border border-[var(--ps-pink)]/40 bg-[var(--ps-pink)]/10 py-1.5 text-[9px] text-[var(--ps-pink)] hover:bg-[var(--ps-pink)]/20"
            >
              Gigs
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {DEMO_TEAM.map((m) => (
            <MemberCell key={m.id} member={m} />
          ))}
        </div>
      </div>
    </section>
  );
}
