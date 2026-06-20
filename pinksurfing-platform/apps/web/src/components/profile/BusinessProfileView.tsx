'use client';

import { useMemo, useState } from 'react';
import type { BusinessProfileData, BusinessStoreLink } from '@/lib/business-profile-data';
import { storeMessage } from '@/lib/business-profile-data';
import type { NetworkPerson } from '@/lib/profile-data';
import type { SessionUser } from '@/lib/types/user';
import { BusinessCardFlipView } from '@/components/cards/BusinessCardFlipView';
import { snapshotFromProfile } from '@/lib/business-card-types';
import { resolveBusinessLogoUrl } from '@/components/profile/ProfileAvatarStack';
import { ProfileStatusPicker } from '@/components/profile/ProfileStatusPicker';
import { SettingsIcon } from '@/components/icons/SettingsIcon';
import { CollapsibleFiltersPanel } from '@/components/contacts/CollapsibleFiltersPanel';
import {
  defaultDiscoverFilters,
  filterByDiscoverFilters,
  loadFindZip,
  saveFindZip,
  statesFromPeople,
  type DiscoverFilters,
} from '@/lib/discover-people';

function HexField({ label, value }: { label: string; value: string }) {
  return (
    <div className="ps-hex-field">
      <span className="ps-hex-field-label">{label}</span>
      <span className="ps-hex-field-value">{value}</span>
    </div>
  );
}

function NetworkGrid({ people }: { people: NetworkPerson[] }) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
      {people.map((p) => (
        <div key={p.id} className="text-center">
          <div className="mx-auto mb-1 aspect-[4/3] w-full overflow-hidden rounded-lg border border-[var(--ps-brd)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="truncate text-[8px] text-[var(--ps-white)]">{p.name}</div>
        </div>
      ))}
    </div>
  );
}

function StoreBlock({ store, logoUrl, businessName }: { store: BusinessStoreLink; logoUrl?: string; businessName?: string }) {
  const msg = storeMessage(store);
  const clickable = store.type !== 'none';

  const inner = (
    <>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-8 w-auto max-w-[100px] object-contain" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] text-[10px] text-[var(--ps-dim)]">
          {(businessName ?? 'Biz').slice(0, 1)}
        </div>
      )}
      <span className={`text-[8px] leading-snug ${clickable ? 'text-[var(--ps-cyan)]' : 'text-[var(--ps-dim)]'}`}>
        {msg}
      </span>
    </>
  );

  if (!clickable) {
    return <div className="mt-2 flex flex-col items-start gap-1">{inner}</div>;
  }

  return (
    <a
      href={store.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex flex-col items-start gap-1 transition-opacity hover:opacity-85"
    >
      {inner}
    </a>
  );
}

type Props = {
  profile: BusinessProfileData;
  user?: SessionUser | null;
  /** Persist ZIP filter under this email when `user` is absent (e.g. modal viewer) */
  filterEmail?: string;
  /** Show business card inline (Me section) vs button only */
  showCardInline?: boolean;
  settingsVersion?: number;
  onOpenSettings?: () => void;
};

export function BusinessProfileView({
  profile,
  user = null,
  filterEmail,
  showCardInline = false,
  settingsVersion = 0,
  onOpenSettings,
}: Props) {
  const email = filterEmail ?? user?.email ?? 'guest';
  const [filters, setFilters] = useState<DiscoverFilters>(() =>
    defaultDiscoverFilters(loadFindZip(email))
  );
  const [cardOpen, setCardOpen] = useState(showCardInline);

  const cardSnapshot = useMemo(
    () => snapshotFromProfile(profile, user),
    [profile, user, settingsVersion]
  );

  const allNetwork = useMemo(
    () => [...profile.firstLine, ...profile.secondLine],
    [profile.firstLine, profile.secondLine]
  );

  const networkStates = useMemo(() => statesFromPeople(allNetwork), [allNetwork]);

  const filteredFirst = useMemo(
    () => filterByDiscoverFilters(profile.firstLine, filters),
    [profile.firstLine, filters]
  );

  const filteredSecond = useMemo(
    () => filterByDiscoverFilters(profile.secondLine, filters),
    [profile.secondLine, filters]
  );

  const patchFilters = (patch: Partial<DiscoverFilters>) => {
    setFilters((f) => {
      const next = { ...f, ...patch };
      if (patch.zip != null) saveFindZip(email, patch.zip);
      return next;
    });
  };

  const displayName = profile.credentials ? `${profile.name} ${profile.credentials}` : profile.name;
  const filteredCount = filteredFirst.length + filteredSecond.length;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)]">
        <div className="grid grid-cols-3 gap-3 p-3 sm:gap-4 sm:p-4">
          <div className="relative col-span-2 aspect-[4/3] overflow-hidden rounded-xl border border-[var(--ps-brd)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)]/90 text-[var(--ps-muted)] backdrop-blur-sm transition-colors hover:border-[var(--ps-cyan)]/40 hover:text-[var(--ps-white)]"
                aria-label="Open settings"
                title="Personal & business details"
              >
                <SettingsIcon size={16} />
              </button>
            )}
            <span className="absolute bottom-2 left-2 rounded bg-[#2563eb] px-2 py-0.5 text-[9px] font-medium text-white">
              Profile
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <HexField label="Position" value={profile.position} />
            <HexField
              label="Industry"
              value={`${profile.industryCategory} · ${profile.industry}`}
            />
            <HexField label="Location" value={profile.location} />
            <HexField label="About me" value={profile.aboutMe} />
            <div className="ps-hex-field">
              <span className="ps-hex-field-label">Deals interested in</span>
              <span className="ps-hex-field-value leading-snug">
                {profile.dealsInterestedIn.join(' · ')}
              </span>
            </div>
            <StoreBlock
              store={profile.store}
              logoUrl={resolveBusinessLogoUrl(user, profile.businessLogoUrl)}
              businessName={profile.businessName}
            />
          </div>
        </div>
        <div className="border-t border-[var(--ps-brd)] px-4 py-1">
          <ProfileStatusPicker email={email} />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)]">
        <div className="border-b border-[var(--ps-brd)] px-4 py-3">
          <h3 className="text-[12px] font-bold text-[var(--ps-white)]">{displayName}&apos;s Network</h3>
        </div>
        <CollapsibleFiltersPanel
          filters={filters}
          onChange={patchFilters}
          states={networkStates}
          meta={
            <span className="text-[9px] text-[var(--ps-dim)]">
              {filteredCount} of {allNetwork.length} contacts
            </span>
          }
          hint="Filters apply to 1st & 2nd line · tap Sort / filter for location & industry"
        />
        <div className="space-y-4 p-3">
          <div>
            <div className="mb-2 text-[10px] font-semibold text-[var(--ps-white)]">
              1st line ({filteredFirst.length})
            </div>
            {filteredFirst.length === 0 ? (
              <p className="text-[9px] text-[var(--ps-dim)]">No 1st-line contacts match these filters.</p>
            ) : (
              <NetworkGrid people={filteredFirst} />
            )}
          </div>
          <div>
            <div className="mb-2 text-[10px] font-semibold text-[var(--ps-white)]">
              2nd line ({filteredSecond.length})
            </div>
            {filteredSecond.length === 0 ? (
              <p className="text-[9px] text-[var(--ps-dim)]">No 2nd-line contacts match these filters.</p>
            ) : (
              <NetworkGrid people={filteredSecond} />
            )}
          </div>
        </div>
      </section>

      {showCardInline || cardOpen ? (
        <BusinessCardFlipView
          card={cardSnapshot}
          variant="owner"
          user={user}
        />
      ) : (
        <button
          type="button"
          onClick={() => setCardOpen(true)}
          className="w-full rounded-full border border-[var(--ps-white)] bg-black py-3 text-[12px] font-medium text-[var(--ps-white)] transition-colors hover:border-[var(--ps-pink)] hover:text-[var(--ps-pink)]"
        >
          Business Card
        </button>
      )}
    </div>
  );
}
