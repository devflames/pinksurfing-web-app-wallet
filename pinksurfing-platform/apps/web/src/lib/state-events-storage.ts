'use client';

const PREFIX = 'ps-state-events-published:';

function storageKey(contactId: string): string {
  return `${PREFIX}${contactId}`;
}

export function loadPublishedStateKeys(contactId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(storageKey(contactId));
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(list);
  } catch {
    return new Set();
  }
}

export function markStateEventPublished(contactId: string, dedupeKey: string): void {
  if (typeof window === 'undefined') return;
  const set = loadPublishedStateKeys(contactId);
  set.add(dedupeKey);
  const trimmed = [...set].slice(-200);
  localStorage.setItem(storageKey(contactId), JSON.stringify(trimmed));
}

export function wasStateEventPublished(contactId: string, dedupeKey: string): boolean {
  return loadPublishedStateKeys(contactId).has(dedupeKey);
}
