import { BUSINESS_QR_CODES, PAYCHAT_QR_CODES } from './demo-data';
import {
  dynamicBusinessContactId,
  upsertDynamicBusinessContact,
} from './dynamic-business-contacts';
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
const BUSINESS_REGISTRY_KEY = 'ps-business-qr-registry';
const PENDING_JOIN_KEY = 'ps-pending-qr-join';
const JOIN_RESULT_KEY = 'ps-qr-join-result';

export type PaychatRegistryEntry = {
  userId: string;
  name: string;
  code: string;
  askUsd?: number;
};

export type BusinessRegistryEntry = {
  userId: string;
  name: string;
  code: string;
  email?: string;
};

export type PendingQrJoin = {
  kind: QrJoinKind;
  code: string;
};

export type QrJoinResult = {
  kind: QrJoinKind;
  contactId: string;
};

export function qrJoinBaseUrl(): string {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim();
  if (origin) return origin.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://app.pinksurfing.com';
}

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
  if (email) return email.split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return 'PS-DEMO';
}

export function normalizePaychatCode(code: string): string {
  const upper = code.trim().toUpperCase();
  return upper.startsWith('PS-') ? upper : `PS-${upper}`;
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

function loadBusinessRegistry(): BusinessRegistryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BUSINESS_REGISTRY_KEY);
    return raw ? (JSON.parse(raw) as BusinessRegistryEntry[]) : [];
  } catch {
    return [];
  }
}

export function findPaychatRegistryEntry(code: string): PaychatRegistryEntry | null {
  const key = normalizePaychatCode(code);
  return loadPaychatRegistry().find((e) => e.code.toUpperCase() === key) ?? null;
}

export function findBusinessRegistryEntry(code: string): BusinessRegistryEntry | null {
  const key = code.trim().toUpperCase();
  return loadBusinessRegistry().find((e) => e.code.toUpperCase() === key) ?? null;
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

export function registerUserBusinessQr(
  user: SessionUser | null,
  displayName: string,
  businessName?: string
): string {
  const code = businessInviteCodeForUser(user);
  if (!user?.id || typeof window === 'undefined') return code;
  const entry: BusinessRegistryEntry = {
    userId: user.id,
    name: businessName?.trim() || displayName,
    code,
    email: user.email,
  };
  const list = loadBusinessRegistry().filter((e) => e.userId !== user.id);
  localStorage.setItem(BUSINESS_REGISTRY_KEY, JSON.stringify([...list, entry]));
  return code;
}

function resolveRegistryPaychat(code: string): { contactId: string; label: string } | null {
  const entry = findPaychatRegistryEntry(code);
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

function resolveRegistryBusiness(code: string): { contactId: string; label: string } | null {
  const entry = findBusinessRegistryEntry(code);
  if (!entry) return null;
  const contactId = dynamicBusinessContactId(entry.userId);
  upsertDynamicBusinessContact({
    id: contactId,
    name: entry.name,
    code: entry.code,
    email: entry.email,
  });
  return { contactId, label: entry.name };
}

export function buildQrPayload(kind: QrJoinKind, code: string): string {
  return `${qrJoinBaseUrl()}/join/${kind}/${encodeURIComponent(code.trim().toUpperCase())}`;
}

export function parseQrInput(raw: string): { kind: QrJoinKind; code: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(
    /(?:app\.)?pinksurfing\.com\/join\/(business|paychat)\/([^/?#]+)/i
  );
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
  if (findPaychatRegistryEntry(upper)) return { kind: 'paychat', code: normalizePaychatCode(upper) };
  if (findBusinessRegistryEntry(upper)) return { kind: 'business', code: upper };
  if (upper.startsWith('PS-')) return { kind: 'paychat', code: upper };

  return null;
}

export function resolveQrJoin(
  kind: QrJoinKind,
  code: string
): { contactId: string; label: string } | null {
  const key = kind === 'paychat' ? normalizePaychatCode(code) : code.trim().toUpperCase();
  const map = kind === 'business' ? BUSINESS_QR_CODES : PAYCHAT_QR_CODES;
  if (map[key]) return map[key];
  if (kind === 'paychat') return resolveRegistryPaychat(key);
  return resolveRegistryBusiness(key);
}

export function stashPendingQrJoin(kind: QrJoinKind, code: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PENDING_JOIN_KEY, JSON.stringify({ kind, code }));
}

export function consumePendingQrJoin(): PendingQrJoin | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_JOIN_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_JOIN_KEY);
    return JSON.parse(raw) as PendingQrJoin;
  } catch {
    return null;
  }
}

export function stashQrJoinResult(result: QrJoinResult): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(JOIN_RESULT_KEY, JSON.stringify(result));
}

export function consumeQrJoinResult(): QrJoinResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(JOIN_RESULT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(JOIN_RESULT_KEY);
    return JSON.parse(raw) as QrJoinResult;
  } catch {
    return null;
  }
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
