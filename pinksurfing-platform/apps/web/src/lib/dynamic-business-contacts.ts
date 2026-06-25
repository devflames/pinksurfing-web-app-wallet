import type { Contact } from '@pinksurfing/ui';

export type DynamicBusinessContact = {
  id: string;
  name: string;
  code: string;
  email?: string;
  userId?: string;
};

const KEY = 'ps-dynamic-business-contacts';

export function dynamicBusinessContactId(userId: string): string {
  return `business-scan-${userId}`;
}

export function loadDynamicBusinessContacts(): DynamicBusinessContact[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DynamicBusinessContact[]) : [];
  } catch {
    return [];
  }
}

export function upsertDynamicBusinessContact(entry: DynamicBusinessContact): void {
  if (typeof window === 'undefined') return;
  const list = loadDynamicBusinessContacts().filter((c) => c.id !== entry.id);
  localStorage.setItem(KEY, JSON.stringify([...list, entry]));
}

export function dynamicBusinessContactToUi(entry: DynamicBusinessContact): Contact {
  return {
    id: entry.id,
    userId: entry.userId,
    name: entry.name,
    initials: entry.name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    color: '#AFA9EC',
    bg: '#AFA9EC20',
    type: 'business',
    biz: true,
    preview: 'Added via business card',
    time: '',
  };
}
