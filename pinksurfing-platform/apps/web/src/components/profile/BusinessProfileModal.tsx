'use client';

import type { BusinessProfileData } from '@/lib/business-profile-data';
import type { BusinessCardSnapshot } from '@/lib/business-card-types';
import { BusinessProfileView } from './BusinessProfileView';
import { BusinessCardProfileActions } from './BusinessCardProfileActions';
import { snapshotFromProfile } from '@/lib/business-card-types';

type Props = {
  profile: BusinessProfileData | null;
  onClose: () => void;
  viewerEmail?: string;
  onShareToChat?: (card: BusinessCardSnapshot) => void;
};

export function BusinessProfileModal({ profile, onClose, viewerEmail = 'guest', onShareToChat }: Props) {
  if (!profile) return null;

  const title = profile.credentials ? `${profile.name} ${profile.credentials}` : profile.name;
  const card = snapshotFromProfile(profile);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[var(--ps-brd)] bg-[var(--ps-bg)] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="biz-profile-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--ps-brd)] bg-[var(--ps-surf)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-[var(--ps-cyan)] hover:underline"
          >
            ← Back
          </button>
          <span id="biz-profile-title" className="text-[11px] font-semibold uppercase tracking-widest text-[var(--ps-white)]">
            {title}
          </span>
          <span className="w-10" aria-hidden />
        </div>
        <div className="overflow-y-auto p-4">
          <BusinessCardProfileActions
            card={card}
            email={viewerEmail}
            onShareToChat={onShareToChat}
          />
          <BusinessProfileView profile={profile} showCardInline filterEmail={viewerEmail} />
        </div>
      </div>
    </div>
  );
}
