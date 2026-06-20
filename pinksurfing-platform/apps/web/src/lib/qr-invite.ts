import { BUSINESS_QR_CODES, PAYCHAT_QR_CODES } from './demo-data';
import {
  dynamicPaychatContactId,
  upsertDynamicPaychatContact,
} from './dynamic-paychat-contacts';
import type { SessionUser } from './types/user';

export type QrJoinKind = 'business' | 'paychat';

const STORAGE: Record<QrJoinKind, string> = {
  business: 'ps-joined-business',
  paychat: 'ps-joined-paychat',
};

const PAYCHAT_REGISTRY_KEY = 'ps-paychat-qr-registry';

export type PaychatRegistryEntry = {
  userId: string;
  name: string;
  code: string;
  askUsd?: number;
};

export function paychatInviteCodeForUser(user: SessionUser | null): string {
  if (user?.pspayId?.trim()) {
    const id = user.pspayId.trim().toUpperCase();
    return id.startsWith('PS-') ? id : `PS-${id}`;
  }
  const email = user?.email?.trim() ?? '';
  if (email) {
    const local = email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    return `PS-${local || 'USER'}`;
  }
  return 'PS-USER';
}

export function businessInviteCodeForUser(user: SessionUser | null): string {
  const email = user?.email?.trim() ?? '';
  if (email) return email.split('@')[0].toUpperCase().slice(0, 12);
  return 'PS-DEMO';
}

export function registerUserPaychatQr(
  user: SessionUser | null,
  displayName: string,
  askUsd?: number
): string {
  const code = paychatInviteCodeForUser(user);
  if (!user?.id || typeof window === 'undefined') return code;
  const entry: PaychatRegistryEntry = {
    userId: user.id,
    name: displayName,
    code,
    askUsd,
  };
  const list = loadPaychatRegistry().filter((e) => e.userId !== user.id);
  localStorage.setItem(PAYCHAT_REGISTRY_KEY, JSON.stringify([...list, entry]));
  return code;
}

function loadPaychatRegistry(): PaychatRegistryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PAYCHAT_REGISTRY_KEY);
    return raw ? (JSON.parse(raw) as PaychatRegistryEntry[]) : [];
  } catch {
    return [];
  }
}

function resolveRegistryPaychat(code: string): { contactId: string; label: string } | null {
  const key = code.trim().toUpperCase();
  const entry = loadPaychatRegistry().find((e) => e.code.toUpperCase() === key);
  if (!entry) return null;
  const contactId = dynamicPaychatContactId(entry.userId);
  upsertDynamicPaychatContact({
    id: contactId,
    name: entry.name,
    code: entry.code,
    askUsd: entry.askUsd,
  });
  return { contactId, label: entry.name };
}

export function buildQrPayload(kind: QrJoinKind, code: string): string {
  return `https://pinksurfing.com/join/${kind}/${encodeURIComponent(code.trim().toUpperCase())}`;
}

export function parseQrInput(raw: string): { kind: QrJoinKind; code: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/pinksurfing\.com\/join\/(business|paychat)\/([^/?#]+)/i);
  if (urlMatch) {
    return { kind: urlMatch[1] as QrJoinKind, code: decodeURIComponent(urlMatch[2]).toUpperCase() };
  }

  const schemeMatch = trimmed.match(/^pinksurfing:\/\/join\/(business|paychat)\/(.+)$/i);
  if (schemeMatch) {
    return { kind: schemeMatch[1] as QrJoinKind, code: schemeMatch[2].toUpperCase() };
  }

  const upper = trimmed.toUpperCase();
  if (BUSINESS_QR_CODES[upper]) return { kind: 'business', code: upper };
  if (PAYCHAT_QR_CODES[upper]) return { kind: 'paychat', code: upper };
  if (loadPaychatRegistry().some((e) => e.code.toUpperCase() === upper)) {
    return { kind: 'paychat', code: upper };
  }

  return null;
}

export function resolveQrJoin(
  kind: QrJoinKind,
  code: string
): { contactId: string; label: string } | null {
  const key = code.trim().toUpperCase();
  const map = kind === 'business' ? BUSINESS_QR_CODES : PAYCHAT_QR_CODES;
  if (map[key]) return map[key];
  if (kind === 'paychat') return resolveRegistryPaychat(key);
  return null;
}

export function getJoinedContactIds(kind: QrJoinKind): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE[kind]);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isContactJoined(kind: QrJoinKind, contactId: string): boolean {
  return getJoinedContactIds(kind).includes(contactId);
}

export function joinContactViaQr(kind: QrJoinKind, contactId: string): void {
  if (typeof window === 'undefined') return;
  const current = getJoinedContactIds(kind);
  if (current.includes(contactId)) return;
  localStorage.setItem(STORAGE[kind], JSON.stringify([...current, contactId]));
}
