'use client';

import { MISC_CARD_TYPES } from '@/lib/wallet-card-types';
import { EditableCardPanel } from './EditableCardPanel';

type Props = { email: string };

export function MiscCardsPanel({ email }: Props) {
  return (
    <EditableCardPanel
      email={email}
      category="misc"
      types={MISC_CARD_TYPES}
      emptyHint="Everyday cards with nicknames, barcode scan, and context — e.g. “Show this at Costco.”"
    />
  );
}
