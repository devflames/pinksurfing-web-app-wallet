import type { WalletCardRecord } from '@/lib/wallet-card-types';
import type { CardTypeDef } from '@/lib/wallet-card-types';
import { migrateWalletCard } from '@/lib/wallet-card-universal';

export type WalletCardCategory = 'health' | 'professional' | 'misc';

const PREFIX = 'ps-wallet-cards';

function storageKey(email: string, category: WalletCardCategory): string {
  return `${PREFIX}:${category}:${email || 'guest'}`;
}

export function loadWalletCards(
  email: string,
  category: WalletCardCategory,
  types?: CardTypeDef[]
): WalletCardRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(email, category));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WalletCardRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((card) => {
      const typeDef = types?.find((t) => t.id === card.type);
      return migrateWalletCard(card, typeDef, category);
    });
  } catch {
    return [];
  }
}

export function saveWalletCards(
  email: string,
  category: WalletCardCategory,
  cards: WalletCardRecord[]
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(email, category), JSON.stringify(cards));
  } catch {
    /* ignore quota — photos may be large */
  }
}

export function newCardId(): string {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
