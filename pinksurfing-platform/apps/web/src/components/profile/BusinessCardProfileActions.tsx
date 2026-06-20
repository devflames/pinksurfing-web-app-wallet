'use client';

import { useState } from 'react';
import type { BusinessCardSnapshot } from '@/lib/business-card-types';
import { canShareBusinessCard } from '@/lib/business-card-types';
import {
  isBusinessCardSaved,
  saveBusinessCard,
} from '@/lib/saved-business-cards';
import { BusinessCardShareSheet } from '@/components/cards/BusinessCardShareSheet';
import type { SessionUser } from '@/lib/types/user';

type Props = {
  card: BusinessCardSnapshot;
  email: string;
  user?: SessionUser | null;
  onShareToChat?: (card: BusinessCardSnapshot) => void;
};

export function BusinessCardProfileActions({ card, email, user, onShareToChat }: Props) {
  const [saved, setSaved] = useState(() => isBusinessCardSaved(email, card.contactId));
  const [shareOpen, setShareOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const canShare = canShareBusinessCard(card.contactId);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 2000);
  };

  const save = () => {
    saveBusinessCard(email, card);
    setSaved(true);
    flash('Business card saved');
  };

  return (
    <div className="mb-4 rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)] p-3">
      <div className="mb-2 text-[10px] font-medium text-[var(--ps-white)]">Business card</div>
      {msg && <p className="mb-2 text-[9px] text-[var(--ps-cyan)]">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saved}
          className="rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)] px-3 py-1.5 text-[9px] text-[var(--ps-cyan)] disabled:opacity-50"
        >
          {saved ? 'Saved' : 'Save card'}
        </button>
        {canShare ? (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="rounded-lg border border-[var(--ps-pink)]/40 bg-[var(--ps-pink)]/10 px-3 py-1.5 text-[9px] text-[var(--ps-pink)]"
          >
            Share card
          </button>
        ) : (
          <span className="self-center text-[8px] text-[var(--ps-dim)]">
            Share blocked — not in your 1st line
          </span>
        )}
      </div>
      <BusinessCardShareSheet
        open={shareOpen}
        card={card}
        user={user}
        onClose={() => setShareOpen(false)}
        onShareToChat={onShareToChat}
        onShared={flash}
      />
    </div>
  );
}
