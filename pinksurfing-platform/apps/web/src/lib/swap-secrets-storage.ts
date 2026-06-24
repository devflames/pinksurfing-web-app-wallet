'use client';

const PREFIX = 'pinksurfing_swap_secrets_v1:';

export type StoredSwapSecret = {
  swapId: string;
  secret: string;
  createdAt: string;
};

function storageKey(email: string): string {
  return `${PREFIX}${email.trim().toLowerCase()}`;
}

export function loadSwapSecrets(email: string | undefined | null): StoredSwapSecret[] {
  if (!email || typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(email));
    return raw ? (JSON.parse(raw) as StoredSwapSecret[]) : [];
  } catch {
    return [];
  }
}

export function saveSwapSecret(email: string, entry: StoredSwapSecret): void {
  if (!email || typeof window === 'undefined') return;
  const list = loadSwapSecrets(email).filter((s) => s.swapId !== entry.swapId);
  list.push(entry);
  localStorage.setItem(storageKey(email), JSON.stringify(list.slice(-20)));
}

export function getSwapSecret(email: string, swapId: string): string | null {
  return loadSwapSecrets(email).find((s) => s.swapId === swapId)?.secret ?? null;
}
