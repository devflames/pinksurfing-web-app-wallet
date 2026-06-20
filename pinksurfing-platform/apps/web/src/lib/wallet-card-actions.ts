import type { CardTypeDef, WalletCardRecord } from '@/lib/wallet-card-types';
import { daysUntilExpiry, expiryStatus, formatExpiryDate } from '@/lib/wallet-card-expiry';
import {
  displayNickname,
  recordExpirationUniversal,
} from '@/lib/wallet-card-universal';

export type CardAction = {
  id: string;
  text: string;
  tone: 'alert' | 'share' | 'balance';
};

function balanceFromFields(fields: Record<string, string>): string | null {
  const raw = fields.balance?.trim();
  if (!raw) return null;
  if (/^\$/.test(raw)) return raw;
  if (/^\d+(\.\d{1,2})?$/.test(raw)) return `$${raw}`;
  return raw;
}

/** Personal note — the only self-note surfaced on cards */
export function notesToSelfText(record: WalletCardRecord): string | null {
  const note = record.universal?.notesToSelf?.trim();
  return note || null;
}

/** Expiry / renewal alerts only */
export function cardExpiryAlert(
  record: WalletCardRecord,
  typeDef?: CardTypeDef
): CardAction | null {
  const u = record.universal;
  const nickname = displayNickname(record, typeDef);
  const exp = recordExpirationUniversal(record);
  const renewalOn = u?.renewalReminder !== false;
  if (!renewalOn || !exp) return null;

  const days = daysUntilExpiry(exp);
  const status = expiryStatus(exp);
  if (status === 'expired') {
    return {
      id: 'expired',
      text: `${nickname} expired ${formatExpiryDate(exp)}.`,
      tone: 'alert',
    };
  }
  if (status === 'warning' && days !== null) {
    return {
      id: 'expiring',
      text: `${nickname} expires in ${days} day${days === 1 ? '' : 's'}.`,
      tone: 'alert',
    };
  }
  return null;
}

/** Non-note context: balance, sharing, gym contract, etc. */
export function cardContextPrompts(
  record: WalletCardRecord,
  typeDef?: CardTypeDef
): CardAction[] {
  const actions: CardAction[] = [];
  const u = record.universal;
  const nickname = displayNickname(record, typeDef);
  const fields = record.fields;

  if (record.type === 'gym' && fields.expirationDate) {
    actions.push({
      id: 'gym-contract',
      text: `Gym contract end date is ${formatExpiryDate(fields.expirationDate)}.`,
      tone: 'alert',
    });
  }

  const balance = balanceFromFields(fields);
  if (balance && record.type === 'gift_card') {
    actions.push({
      id: 'balance',
      text: `Gift card has ${balance} left.`,
      tone: 'balance',
    });
  } else if (balance && record.type === 'transit') {
    actions.push({ id: 'transit-balance', text: `Transit balance: ${balance}.`, tone: 'balance' });
  }

  if (u?.sharedWithFamily) {
    const who = u.sharedWithNames?.trim() || 'family';
    actions.push({
      id: 'shared',
      text: `${nickname} is shared with ${who}.`,
      tone: 'share',
    });
  }

  return actions;
}
