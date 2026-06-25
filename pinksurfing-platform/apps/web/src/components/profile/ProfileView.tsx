'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SessionUser } from '@/lib/types/user';
import { DEFAULT_PROFILE, profileForUser } from '@/lib/profile-data';
import { displayName } from '@/lib/auth-storage';
import { businessProfileForUser } from '@/lib/business-profile-data';
import { IdCardModal, PROFILE_CARD_BUTTONS, type IdCardKind } from './IdCardModal';
import { ProfileAvatarStack } from './ProfileAvatarStack';
import { BusinessProfileView } from './BusinessProfileView';
import { WalletIdentityCard } from '@/components/wallet/WalletIdentityCard';
import { SavedBusinessCardsPanel } from './SavedBusinessCardsPanel';
import { ProfileSettingsPage } from './ProfileSettingsPage';
import { ProfileStatusPicker } from './ProfileStatusPicker';
import { KycAffiliationRow } from './KycAffiliationRow';

type Props = {
  user: SessionUser | null;
};

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--ps-brd)]/40 py-2.5 last:border-0">
      <span className="text-[11px] text-[var(--ps-dim)]">{label}</span>
      <span className="text-right text-[11px] font-medium text-[var(--ps-white)]">{value}</span>
    </div>
  );
}

function meAvatarFrontKey(email: string): string {
  return `ps-me-avatar-front-${email}`;
}

export function ProfileView({ user }: Props) {
  const [mode, setMode] = useState<'personal' | 'business'>('personal');
  const [frontPhoto, setFrontPhoto] = useState<'personal' | 'business'>('personal');
  const [openCard, setOpenCard] = useState<IdCardKind | null>(null);
  const [cardsOpen, setCardsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const profile = profileForUser(user, DEFAULT_PROFILE);
  const name = displayName(user);
  const businessProfile = useMemo(() => businessProfileForUser(user), [user]);
  const email = user?.email ?? 'guest';

  useEffect(() => {
    const saved = localStorage.getItem(meAvatarFrontKey(email));
    if (saved === 'personal' || saved === 'business') {
      setFrontPhoto(saved);
    }
  }, [email]);

  const swapFrontPhoto = () => {
    setFrontPhoto((current) => {
      const next = current === 'personal' ? 'business' : 'personal';
      localStorage.setItem(meAvatarFrontKey(email), next);
      return next;
    });
  };

  if (settingsOpen) {
    return (
      <ProfileSettingsPage
        user={user}
        onClose={() => setSettingsOpen(false)}
        onSaved={() => setSettingsVersion((v) => v + 1)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <WalletIdentityCard variant="full" collapsible />

      {mode === 'business' ? (
        <BusinessProfileView
          profile={businessProfile}
          user={user}
          showCardInline
          settingsVersion={settingsVersion}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <section className="rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)]">
          <div
            className="px-4 pb-4 pt-6 text-center"
            style={{
              background: 'linear-gradient(180deg, rgba(147,63,255,0.12) 0%, transparent 100%)',
            }}
          >
            <ProfileAvatarStack
              user={user}
              personalLabel={name}
              businessLabel={profile.businessName}
              frontPhoto={frontPhoto}
              onSwap={swapFrontPhoto}
              onOpenSettings={() => setSettingsOpen(true)}
            />
            <div className="mt-1 text-[11px] text-[var(--ps-muted)]">{profile.position}</div>
          </div>

          <div className="border-t border-[var(--ps-brd)] px-4 py-1">
            <FieldRow label="Position" value={profile.position} />
            <FieldRow
              label="Industry"
              value={`${profile.industryCategory} · ${profile.industry}`}
            />
            <FieldRow label="Location" value={profile.location} />
            <KycAffiliationRow affiliation="PinkSurfing Pro" />
            <ProfileStatusPicker email={email} />
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)]">
        <div className="flex items-center justify-between border-b border-[var(--ps-brd)] px-4 py-3">
          <span className="text-[12px] font-medium text-[var(--ps-white)]">Profile mode</span>
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'personal' ? 'business' : 'personal'))}
            className="rounded-full border border-[var(--ps-brd)] px-3 py-1 text-[10px] text-[var(--ps-cyan)]"
          >
            {mode === 'personal' ? 'Show profile network view' : 'Switch to Personal'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCardsOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-[12px] font-medium text-[var(--ps-white)]"
        >
          My Cards &amp; IDs
          <span className="text-[var(--ps-dim)]">{cardsOpen ? '▾' : '▸'}</span>
        </button>
        {cardsOpen && (
          <div className="grid grid-cols-2 gap-2 border-t border-[var(--ps-brd)] p-3 sm:grid-cols-3">
            {PROFILE_CARD_BUTTONS.map(({ label, kind }) => (
              <button
                key={kind}
                type="button"
                onClick={() => setOpenCard(kind)}
                className="rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)] py-2.5 text-[10px] text-[var(--ps-muted)] transition-colors hover:border-[var(--ps-cyan)]/40 hover:bg-[var(--ps-card2)] hover:text-[var(--ps-cyan)] active:scale-[0.98]"
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <SavedBusinessCardsPanel email={email} />
      </section>

      <IdCardModal
        kind={openCard}
        onClose={() => setOpenCard(null)}
        user={user}
        profileMode={mode}
        businessName={profile.businessName}
        position={profile.position}
        industry={profile.industry}
        location={profile.location}
      />
    </div>
  );
}
