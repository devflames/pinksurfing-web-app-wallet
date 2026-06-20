import type { Contact } from '@pinksurfing/ui';

export type DynamicPaychatContact = {
  id: string;
  name: string;
  code: string;
  askUsd?: number;
};

const KEY = 'ps-dynamic-paychat-contacts';

export function dynamicPaychatContactId(userId: string): string {
  return `paychat-scan-${userId}`;
}

export function loadDynamicPaychatContacts(): DynamicPaychatContact[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DynamicPaychatContact[]) : [];
  } catch {
    return [];
  }
}

export function upsertDynamicPaychatContact(entry: DynamicPaychatContact): void {
  if (typeof window === 'undefined') return;
  const list = loadDynamicPaychatContacts().filter((c) => c.id !== entry.id);
  localStorage.setItem(KEY, JSON.stringify([...list, entry]));
}

export function dynamicContactToUi(entry: DynamicPaychatContact): Contact {
  return {
    id: entry.id,
    name: entry.name,
    initials: entry.name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    color: '#FF7AD1',
    bg: '#FF7AD120',
    type: 'paychat',
    paychatDirection: 'outgoing',
    askUsd: entry.askUsd,
    preview: entry.askUsd != null ? `Scan card to unlock · $${entry.askUsd.toFixed(2)}` : 'Scan card to unlock',
    time: '',
  };
}
