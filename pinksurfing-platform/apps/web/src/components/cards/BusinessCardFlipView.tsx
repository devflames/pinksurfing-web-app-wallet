'use client';

import { useState } from 'react';
import type { BusinessCardSnapshot } from '@/lib/business-card-types';
import { ShareIcon } from '@/components/icons/ShareIcon';
import { BusinessCardDisplay } from './BusinessCardDisplay';
import { BusinessCardBackDisplay } from './BusinessCardBackDisplay';
import { BusinessCardSharePreview } from './BusinessCardSharePreview';
import { BusinessCardShareSheet } from './BusinessCardShareSheet';

type Props = {
  card: BusinessCardSnapshot;
  /** owner = flip + share; shared = both faces, no controls */
  variant?: 'owner' | 'shared';
  compact?: boolean;
  user?: import('@/lib/types/user').SessionUser | null;
  onShareToChat?: (card: BusinessCardSnapshot) => void;
};

function CardFront({
  card,
  compact,
  user,
}: {
  card: BusinessCardSnapshot;
  compact?: boolean;
  user?: import('@/lib/types/user').SessionUser | null;
}) {
  return (
    <BusinessCardDisplay
      user={user}
      name={card.displayName}
      credentials={card.credentials}
      address={card.address}
      phone={card.phone}
      email={card.email}
      inviteCode={card.inviteCode}
      store={card.store}
      businessLogoUrl={card.businessLogoUrl}
      compact={compact}
    />
  );
}

export function BusinessCardFlipView({
  card,
  variant = 'owner',
  compact = false,
  user = null,
  onShareToChat,
}: Props) {
  const [flipped, setFlipped] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const minH = compact ? 'min-h-[200px]' : 'min-h-[240px]';

  if (variant === 'shared') {
    return <BusinessCardSharePreview card={card} user={user} compact={compact} />;
  }

  return (
    <div className="relative">
      <div className="ps-card-flip-scene">
        <div className={`ps-card-flip-inner ${flipped ? 'is-flipped' : ''} ${minH}`}>
          <div className={`ps-card-flip-face ${minH}`}>
            <CardFront card={card} compact={compact} user={user} />
          </div>
          <div className={`ps-card-flip-face ps-card-flip-back ${minH}`}>
            <BusinessCardBackDisplay compact={compact} className="h-full" />
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ps-brd)] bg-[var(--ps-surf)] transition-colors hover:border-[var(--ps-cyan)]/40"
          aria-label="Share business card"
          title="Share front & back"
        >
          <ShareIcon size={18} />
        </button>

        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#ff1493] bg-black text-[#ff1493] shadow-[0_0_12px_rgba(255,20,147,0.35)] transition-transform hover:scale-105"
          aria-label={flipped ? 'Show card front' : 'Show card back'}
          title={flipped ? 'Front — contact info' : 'Back — download app'}
        >
          ⇄
        </button>

        <span className="w-9 text-center text-[8px] text-[var(--ps-dim)]">
          {flipped ? 'Back' : 'Front'}
        </span>
      </div>

      <BusinessCardShareSheet
        open={shareOpen}
        card={card}
        user={user}
        onClose={() => setShareOpen(false)}
        onShareToChat={onShareToChat}
      />
    </div>
  );
}
