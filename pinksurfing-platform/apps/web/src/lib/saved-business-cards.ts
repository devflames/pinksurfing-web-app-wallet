import type { BusinessCardSnapshot } from '@/lib/business-card-types';
import { PINKSURFING_APP_URL } from '@/lib/business-card-types';
import { buildQrPayload } from '@/lib/qr-invite';
import { cardDisplayTitle } from '@/lib/business-card-types';

const KEY = 'ps-saved-business-cards';

function storageKey(email: string): string {
  return `${KEY}:${email || 'guest'}`;
}

export function loadSavedBusinessCards(email: string): BusinessCardSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(email));
    return raw ? (JSON.parse(raw) as BusinessCardSnapshot[]) : [];
  } catch {
    return [];
  }
}

export function saveBusinessCard(email: string, card: BusinessCardSnapshot): void {
  if (typeof window === 'undefined') return;
  const list = loadSavedBusinessCards(email).filter((c) => c.contactId !== card.contactId);
  localStorage.setItem(storageKey(email), JSON.stringify([card, ...list]));
}

export function removeSavedBusinessCard(email: string, contactId: string): void {
  if (typeof window === 'undefined') return;
  const list = loadSavedBusinessCards(email).filter((c) => c.contactId !== contactId);
  localStorage.setItem(storageKey(email), JSON.stringify(list));
}

export function isBusinessCardSaved(email: string, contactId: string): boolean {
  return loadSavedBusinessCards(email).some((c) => c.contactId === contactId);
}

export function buildBusinessCardShareText(card: BusinessCardSnapshot): string {
  const title = cardDisplayTitle(card);
  const bizQr = buildQrPayload('business', card.inviteCode);
  return [
    `PinkSurfing Business Card — ${title}`,
    '',
    '— Front —',
    `${title}`,
    card.address,
    card.phone,
    card.email,
    `Business QR: ${bizQr}`,
    '',
    '— Back —',
    'Join PinkSurfing:',
    PINKSURFING_APP_URL,
    '',
    'Scan the card QR to add to Business contacts.',
  ].join('\n');
}

export function buildBusinessCardShareUrl(card: BusinessCardSnapshot): string {
  return buildQrPayload('business', card.inviteCode);
}
