'use client';

import type { RefObject } from 'react';
import type { BusinessCardSnapshot } from '@/lib/business-card-types';
import type { SessionUser } from '@/lib/types/user';
import { BusinessCardDisplay } from './BusinessCardDisplay';
import { BusinessCardBackDisplay } from './BusinessCardBackDisplay';

type Props = {
  card: BusinessCardSnapshot;
  user?: SessionUser | null;
  compact?: boolean;
  frontRef?: RefObject<HTMLDivElement | null>;
  backRef?: RefObject<HTMLDivElement | null>;
};

/** Front + back stack — used for share preview and off-screen capture */
export function BusinessCardSharePreview({
  card,
  user = null,
  compact = false,
  frontRef,
  backRef,
}: Props) {
  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div ref={frontRef}>
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
      </div>
      <div ref={backRef}>
        <BusinessCardBackDisplay compact={compact} />
      </div>
    </div>
  );
}
