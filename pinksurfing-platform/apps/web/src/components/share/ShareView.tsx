'use client';

import { useState } from 'react';
import type { SessionUser } from '@/lib/types/user';
import { displayName } from '@/lib/auth-storage';
import { QrDisplay } from '@/components/profile/QrDisplay';
import { useShellNav } from '@/lib/shell-nav-context';

const SITE_LINK = 'https://pinksurfing.com';

type Props = {
  user: SessionUser | null;
};

export function ShareView({ user }: Props) {
  const { showToast, navigate } = useShellNav();
  const [copiedSite, setCopiedSite] = useState(false);
  const [copiedProfile, setCopiedProfile] = useState(false);

  const name = displayName(user);
  const profileLink = user?.id
    ? `${SITE_LINK}/app?ref=${encodeURIComponent(user.id)}`
    : `${SITE_LINK}/app`;

  const copy = async (text: string, which: 'site' | 'profile') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'site') {
        setCopiedSite(true);
        window.setTimeout(() => setCopiedSite(false), 2000);
      } else {
        setCopiedProfile(true);
        window.setTimeout(() => setCopiedProfile(false), 2000);
      }
      showToast('Link copied to clipboard');
    } catch {
      showToast('Could not copy — select and copy manually');
    }
  };

  const nativeShare = async () => {
    const payload = {
      title: 'PinkSurfing',
      text: `Join me on PinkSurfing — ${name}`,
      url: profileLink,
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(payload);
        showToast('Shared successfully');
      } catch {
        /* user cancelled */
      }
    } else {
      await copy(profileLink, 'profile');
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--ps-cyan)]/30 bg-[var(--ps-cyan)]/10 text-2xl text-[var(--ps-cyan)]">
          ↗
        </div>
        <h2 className="text-base font-semibold text-[var(--ps-white)]">Share PinkSurfing</h2>
        <p className="mt-1 text-[11px] text-[var(--ps-dim)]">
          Invite contacts or share your profile
        </p>
      </div>

      <div className="flex flex-col items-center rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-5">
        <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--ps-dim)]">
          Profile QR
        </div>
        <QrDisplay value={profileLink} size={128} />
        <p className="mt-3 max-w-xs text-center text-[10px] text-[var(--ps-muted)]">
          Scan to open {name}&apos;s invite link
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-4">
        <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--ps-dim)]">
          Your profile link
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)] p-2">
          <span className="min-w-0 flex-1 truncate px-1 font-mono text-[10px] text-[var(--ps-white)]">
            {profileLink}
          </span>
          <button
            type="button"
            onClick={() => copy(profileLink, 'profile')}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-medium ${
              copiedProfile
                ? 'bg-[var(--ps-green)]/20 text-[var(--ps-green)]'
                : 'bg-[var(--ps-pink)] text-[var(--ps-card)]'
            }`}
          >
            {copiedProfile ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-4">
        <div className="mb-2 text-[10px] uppercase tracking-wide text-[var(--ps-dim)]">
          PinkSurfing.com
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)] p-2">
          <span className="min-w-0 flex-1 truncate px-1 text-[11px] text-[var(--ps-white)]">
            {SITE_LINK}
          </span>
          <button
            type="button"
            onClick={() => copy(SITE_LINK, 'site')}
            className={`shrink-0 rounded-lg border px-3 py-1.5 text-[10px] ${
              copiedSite
                ? 'border-[var(--ps-green)]/40 text-[var(--ps-green)]'
                : 'border-[var(--ps-brd)] text-[var(--ps-cyan)]'
            }`}
          >
            {copiedSite ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={nativeShare}
          className="flex-1 rounded-xl bg-[var(--ps-pink)] py-2.5 text-[11px] font-semibold text-[var(--ps-card)] hover:opacity-90"
        >
          Share invite
        </button>
        <button
          type="button"
          onClick={() => navigate('paychat')}
          className="flex-1 rounded-xl border border-[var(--ps-cyan)]/40 bg-[var(--ps-cyan)]/10 py-2.5 text-[11px] font-medium text-[var(--ps-cyan)]"
        >
          Open PayChat
        </button>
      </div>
    </div>
  );
}
