'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CollapsibleFiltersPanel } from '@/components/contacts/CollapsibleFiltersPanel';
import { TeamMiniProfileBar } from '@/components/groups/TeamMiniProfileBar';
import {
  addGroupMember,
  CONTACT_CAPACITY_STEP,
  CONTACT_CAPACITY_UPGRADE_USD,
  directContactCatalog,
  directContactCount,
  filterDirectContacts,
  findDirectContact,
  findGroup,
  loadContactCapacity,
  loadGroupMemberIds,
  nextGroupId,
  removeGroupMember,
  directContactStates,
  upgradeContactCapacity,
  type BusinessGroup,
  type TeamPerson,
} from '@/lib/group-teams';
import {
  defaultDiscoverFilters,
  loadFindZip,
  saveFindZip,
  type DiscoverFilters,
} from '@/lib/discover-people';
import type { SessionUser } from '@/lib/types/user';

type Props = {
  user: SessionUser | null;
  initialGroupId: string;
  onBack: () => void;
  onVisitProfile?: (contactId: string) => void;
};

export function EditTeamsOverlay({
  user,
  initialGroupId,
  onBack,
  onVisitProfile,
}: Props) {
  const email = user?.email ?? 'guest';
  const [groupId, setGroupId] = useState(initialGroupId);
  const [memberIds, setMemberIds] = useState<string[]>(() =>
    loadGroupMemberIds(email, initialGroupId)
  );
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [capacity, setCapacity] = useState(() => loadContactCapacity(email));
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilters>(() =>
    defaultDiscoverFilters(loadFindZip(email))
  );
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const group = findGroup(groupId) as BusinessGroup;
  const preview = previewId ? findDirectContact(previewId) : null;
  const contactCount = directContactCount();

  useEffect(() => {
    setMemberIds(loadGroupMemberIds(email, groupId));
    setPreviewId(null);
    setSelectedMemberId(null);
  }, [email, groupId]);

  const members = useMemo(
    () =>
      memberIds
        .map((id) => findDirectContact(id))
        .filter((p): p is TeamPerson => !!p),
    [memberIds]
  );

  const memberSet = useMemo(() => new Set(memberIds), [memberIds]);

  /** Full rolodex — all direct contacts (matches X/250 counter) */
  const rolodex = useMemo(() => {
    let list = directContactCatalog();
    list = filterDirectContacts(list, filters);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [filters]);

  const patchFilters = (patch: Partial<DiscoverFilters>) => {
    setFilters((f) => {
      const next = { ...f, ...patch };
      if (patch.zip != null) saveFindZip(email, patch.zip);
      return next;
    });
  };

  const handleAdd = (personId: string) => {
    if (memberSet.has(personId)) return;
    setMemberIds(addGroupMember(email, groupId, personId));
  };

  const handleRemove = (personId: string) => {
    setMemberIds(removeGroupMember(email, groupId, personId));
    if (selectedMemberId === personId) setSelectedMemberId(null);
    if (previewId === personId) setPreviewId(null);
  };

  const handleGridClick = (person: TeamPerson) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      handleAdd(person.id);
      setPreviewId(person.id);
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      setPreviewId(person.id);
      setSelectedMemberId(null);
    }, 220);
  };

  const handleMemberClick = (person: TeamPerson) => {
    setSelectedMemberId(person.id);
    setPreviewId(person.id);
  };

  const visitFromPreview = () => {
    if (!preview || !onVisitProfile) return;
    const match = preview.id.match(/^dc-(c\d+)$/);
    if (match) onVisitProfile(match[1]);
  };

  const confirmUpgrade = () => {
    setCapacity(upgradeContactCapacity(email));
    setShowUpgrade(false);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-[var(--ps-bg)]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--ps-brd)] bg-black/80 px-3 py-2.5 backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          className="text-[14px] text-[var(--ps-white)] hover:text-[var(--ps-cyan)]"
          aria-label="Back"
        >
          ←
        </button>
        <div className="flex-1 text-center text-[12px] font-semibold text-[var(--ps-white)]">
          Edit Teams
        </div>
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4a90d9]/80 text-[10px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
          title="Help"
        >
          ?
        </button>
      </div>

      {preview && (
        <TeamMiniProfileBar person={preview} onVisit={visitFromPreview} />
      )}

      <div className="shrink-0 border-b border-[var(--ps-brd)] bg-[var(--ps-card)]/90 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-[var(--ps-white)]">
              {group.label}
            </div>
            <div className="text-[8px] text-[var(--ps-dim)]">{group.businessName}</div>
          </div>
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <img src={group.adminAvatarUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--ps-brd)] bg-white">
            <img src={group.logoUrl} alt="" className="max-h-[85%] max-w-[85%] object-contain" />
          </div>
          <button
            type="button"
            onClick={() => setGroupId(nextGroupId(groupId))}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4a90d9]/20 text-[#4a90d9] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[#4a90d9]/30"
            title="Switch group"
          >
            ⇄
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-[var(--ps-brd)] bg-[var(--ps-surf)] py-2">
        <div className="flex items-center gap-1 px-2">
          <div className="ps-scroll flex flex-1 gap-2 overflow-x-auto pb-1">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleMemberClick(m)}
                className={`relative shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                  selectedMemberId === m.id
                    ? 'border-[#9747ff] shadow-[0_0_8px_rgba(151,71,255,0.4)]'
                    : 'border-transparent'
                }`}
              >
                <img src={m.avatarUrl} alt={m.name} className="h-14 w-14 object-cover" />
              </button>
            ))}
          </div>
          <span className="shrink-0 text-[10px] text-[var(--ps-dim)]">›</span>
        </div>
        <div className="mx-2 mt-1 text-center text-[8px] text-[var(--ps-dim)]">
          {members.length} in this team
        </div>
      </div>

      <CollapsibleFiltersPanel
        label="Rolodex"
        filters={filters}
        onChange={patchFilters}
        states={directContactStates()}
        toggleLabel="Sort / obtained"
        meta={
          <button
            type="button"
            onClick={() => setShowUpgrade(true)}
            className="rounded-md border border-[var(--ps-cyan)]/30 bg-[var(--ps-cyan)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--ps-cyan)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-[var(--ps-cyan)]/50 hover:bg-[var(--ps-cyan)]/15"
            title={`Add ${CONTACT_CAPACITY_STEP} contacts for $${CONTACT_CAPACITY_UPGRADE_USD}`}
          >
            {contactCount}/{capacity}
          </button>
        }
        trailing={
          selectedMemberId && memberSet.has(selectedMemberId) ? (
            <button
              type="button"
              onClick={() => handleRemove(selectedMemberId)}
              className="rounded-md border border-[var(--ps-red)]/40 bg-[var(--ps-red)]/10 px-2 py-0.5 text-[9px] font-medium text-[var(--ps-red)]"
            >
              Undo
            </button>
          ) : undefined
        }
        hint="Direct contacts only · double-click to add · single-click for profile"
      />

      <div className="mx-3 mb-1 h-1 overflow-hidden rounded-full bg-[var(--ps-card)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--ps-cyan)] to-[#9747ff]"
          style={{ width: `${Math.min(100, (contactCount / capacity) * 100)}%` }}
        />
      </div>

      <div className="ps-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 gap-1.5 p-2">
          {rolodex.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleGridClick(p)}
              className={`group relative aspect-[3/4] overflow-hidden rounded-md border-2 transition-all ${
                previewId === p.id
                  ? 'border-[#9747ff] shadow-[0_0_10px_rgba(151,71,255,0.4)]'
                  : memberSet.has(p.id)
                    ? 'border-[var(--ps-cyan)]/40'
                    : 'border-transparent hover:border-[var(--ps-brd)]'
              }`}
            >
              <img
                src={p.avatarUrl}
                alt={p.name}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              {memberSet.has(p.id) && (
                <span className="absolute bottom-0.5 right-0.5 rounded bg-[var(--ps-cyan)]/90 px-0.5 text-[6px] font-bold text-black">
                  Team
                </span>
              )}
            </button>
          ))}
        </div>
        {rolodex.length === 0 && (
          <p className="p-6 text-center text-[10px] text-[var(--ps-dim)]">
            No direct contacts match — widen your filters.
          </p>
        )}
      </div>

      {showUpgrade && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[280px] rounded-2xl border border-white/10 bg-[var(--ps-card)] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]">
            <h3 className="text-[13px] font-semibold text-[var(--ps-white)]">
              Expand contact list
            </h3>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--ps-muted)]">
              You have {contactCount} of {capacity} direct contacts. Add{' '}
              {CONTACT_CAPACITY_STEP} more for ${CONTACT_CAPACITY_UPGRADE_USD.toFixed(2)}?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowUpgrade(false)}
                className="flex-1 rounded-lg border border-[var(--ps-brd)] py-2 text-[10px] text-[var(--ps-muted)] hover:bg-[var(--ps-surf)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmUpgrade}
                className="flex-1 rounded-lg bg-gradient-to-r from-[var(--ps-cyan)] to-[#9747ff] py-2 text-[10px] font-semibold text-black"
              >
                Add {CONTACT_CAPACITY_STEP} · ${CONTACT_CAPACITY_UPGRADE_USD.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
