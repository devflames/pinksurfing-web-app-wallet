import type { CardTypeDef, WalletCardRecord } from '@/lib/wallet-card-types';
import { mapsDirectionsUrl, telUrl } from '@/lib/business-profile-data';

export type CardContactLink = {
  id: string;
  label: string;
  value: string;
  href: string;
  kind: 'phone' | 'address';
};

const PHONE_KEY = /phone|tel|roadside|claims|support|agent|mobile/i;
const ADDRESS_KEY = /address|location|garage|preferred|homeLocation/i;
const PHONE_VALUE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
const ADDRESS_VALUE = /\d+.{5,}/;

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

function isLikelyAddress(value: string): boolean {
  const v = value.trim();
  if (v.length < 8) return false;
  return /,/.test(v) || /\b(suite|ste|ave|st|rd|blvd|dr|way|ca|tx|ny)\b/i.test(v);
}

export function extractCardContacts(
  card: WalletCardRecord,
  typeDef?: CardTypeDef
): CardContactLink[] {
  const links: CardContactLink[] = [];
  const seen = new Set<string>();

  const push = (label: string, value: string, kind: 'phone' | 'address') => {
    const key = `${kind}:${value}`;
    if (!value.trim() || seen.has(key)) return;
    seen.add(key);
    links.push({
      id: key,
      label,
      value: value.trim(),
      href: kind === 'phone' ? telUrl(value) : mapsDirectionsUrl(value),
      kind,
    });
  };

  for (const field of typeDef?.fields ?? []) {
    const value = card.fields[field.key]?.trim();
    if (!value) continue;
    const kind = field.kind;

    if (kind === 'tel' || PHONE_KEY.test(field.key)) {
      push(field.label, value, 'phone');
      continue;
    }
    if (ADDRESS_KEY.test(field.key) && isLikelyAddress(value)) {
      push(field.label, value, 'address');
    }
  }

  for (const [key, value] of Object.entries(card.fields)) {
    const v = value?.trim();
    if (!v) continue;
    if (PHONE_KEY.test(key) && normalizePhone(v).length >= 10) {
      push(key.replace(/([A-Z])/g, ' $1'), v, 'phone');
    }
    if (ADDRESS_KEY.test(key) && isLikelyAddress(v)) {
      push(key.replace(/([A-Z])/g, ' $1'), v, 'address');
    }
  }

  if (PHONE_VALUE.test(card.fields.notesToSelf ?? '')) {
    const match = card.fields.notesToSelf.match(PHONE_VALUE);
    if (match) push('Phone (notes)', match[0], 'phone');
  }

  return links;
}

export function cardPhoneLinks(links: CardContactLink[]): CardContactLink[] {
  return links.filter((l) => l.kind === 'phone');
}

export function cardAddressLinks(links: CardContactLink[]): CardContactLink[] {
  return links.filter((l) => l.kind === 'address');
}
