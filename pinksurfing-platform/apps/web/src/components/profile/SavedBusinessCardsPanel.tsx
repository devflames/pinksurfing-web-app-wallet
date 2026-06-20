'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BusinessCardSnapshot } from '@/lib/business-card-types';
import { cardDisplayTitle } from '@/lib/business-card-types';
import {
  loadSavedBusinessCards,
  removeSavedBusinessCard,
} from '@/lib/saved-business-cards';
import { BusinessCardFlipView } from '@/components/cards/BusinessCardFlipView';

type Props = {
  email: string;
};

export function SavedBusinessCardsPanel({ email }: Props) {
  const [cards, setCards] = useState<BusinessCardSnapshot[]>([]);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<BusinessCardSnapshot | null>(null);

  const reload = useCallback(() => {
    setCards(loadSavedBusinessCards(email));
  }, [email]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (cards.length === 0) {
    return (
      <div className="border-t border-[var(--ps-brd)] px-3 py-3">
        <div className="text-[10px] font-medium text-[var(--ps-dim)]">Saved business cards</div>
        <p className="mt-1 text-[9px] text-[var(--ps-dim)]">
          Save cards from business profile views — they appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border-t border-[var(--ps-brd)]">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-left"
        >
          <span className="text-[10px] font-medium text-[var(--ps-white)]">
            Saved business cards ({cards.length})
          </span>
          <span className="text-[var(--ps-dim)]">{open ? '▾' : '▸'}</span>
        </button>
        {open && (
          <div className="space-y-1.5 border-t border-[var(--ps-brd)] p-2">
            {cards.map((card) => (
              <div
                key={card.contactId}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2.5 py-2"
              >
                <button
                  type="button"
                  onClick={() => setViewing(card)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-[10px] font-medium text-[var(--ps-white)]">
                    {cardDisplayTitle(card)}
                  </div>
                  <div className="truncate text-[8px] text-[var(--ps-dim)]">{card.inviteCode}</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeSavedBusinessCard(email, card.contactId);
                    reload();
                  }}
                  className="shrink-0 text-[9px] text-[var(--ps-dim)] hover:text-[var(--ps-red)]"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setViewing(null)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-bg)] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--ps-white)]">Saved card</span>
              <button type="button" onClick={() => setViewing(null)} className="text-[var(--ps-dim)]">
                ✕
              </button>
            </div>
            <BusinessCardFlipView card={viewing} variant="shared" />
          </div>
        </div>
      )}
    </>
  );
}
