'use client';

import { useState } from 'react';
import type { SessionUser } from '@/lib/types/user';
import { SettingsIcon } from '@/components/icons/SettingsIcon';
import { PersonalDetailsPanel } from './PersonalDetailsPanel';
import { BusinessDetailsPanel } from './BusinessDetailsPanel';

type Props = {
  user: SessionUser | null;
  onClose: () => void;
  onSaved?: () => void;
};

type Screen = 'menu' | 'personal' | 'business';

export function ProfileSettingsPage({ user, onClose, onSaved }: Props) {
  const [screen, setScreen] = useState<Screen>('menu');

  if (screen === 'personal') {
    return (
      <PersonalDetailsPanel
        user={user}
        fullPage
        onBack={() => setScreen('menu')}
        onSaved={onSaved}
      />
    );
  }

  if (screen === 'business') {
    return (
      <BusinessDetailsPanel
        user={user}
        fullPage
        onBack={() => setScreen('menu')}
        onSaved={onSaved}
      />
    );
  }

  return (
    <div className="flex min-h-[min(100%,720px)] flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--ps-brd)] pb-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--ps-brd)] text-[var(--ps-muted)] transition-colors hover:border-[var(--ps-cyan)]/40 hover:text-[var(--ps-white)]"
          aria-label="Back to profile"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-semibold text-[var(--ps-white)]">Settings</h1>
          <p className="text-[9px] text-[var(--ps-dim)]">
            Personal & business contact information
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center text-[var(--ps-dim)]">
          <SettingsIcon size={18} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-[10px] leading-relaxed text-[var(--ps-muted)]">
          How people add you on PinkSurfing depends on which details you share. Personal contacts
          use your cell and personal email; business contacts use your card QR or business email.
        </p>

        <button
          type="button"
          onClick={() => setScreen('personal')}
          className="flex w-full flex-col rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] px-4 py-3.5 text-left transition-colors hover:border-[var(--ps-cyan)]/40"
        >
          <div className="text-[12px] font-medium text-[var(--ps-white)]">Personal Details</div>
          <div className="mt-1 text-[9px] leading-relaxed text-[var(--ps-dim)]">
            Mobile number, personal email, home address — for personal contacts and phone-book
            invites
          </div>
        </button>

        <button
          type="button"
          onClick={() => setScreen('business')}
          className="flex w-full flex-col rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] px-4 py-3.5 text-left transition-colors hover:border-[var(--ps-pink)]/40"
        >
          <div className="text-[12px] font-medium text-[var(--ps-white)]">Business Details</div>
          <div className="mt-1 text-[9px] leading-relaxed text-[var(--ps-dim)]">
            Business phone, email, address, website — shown on your business card & QR
          </div>
        </button>
      </div>
    </div>
  );
}
