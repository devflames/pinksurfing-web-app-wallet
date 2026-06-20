import type { Contact } from '@pinksurfing/ui';
import { DEMO_CONTACTS } from '@/lib/demo-data';

export type SavedContact = {
  id: string;
  name: string;
  initials: string;
  color: string;
  bg: string;
  hasActiveChat: boolean;
};

/** Personal contacts saved on device — some may not have an active chat yet */
export const SAVED_PERSONAL_CONTACTS: SavedContact[] = [
  {
    id: 'saved-1',
    name: 'Elena Vasquez',
    initials: 'EV',
    color: '#FF7AD1',
    bg: '#FF7AD120',
    hasActiveChat: false,
  },
  {
    id: 'saved-2',
    name: 'Marcus Hill',
    initials: 'MH',
    color: '#6EE7FF',
    bg: '#6EE7FF20',
    hasActiveChat: false,
  },
  {
    id: 'saved-3',
    name: 'Priya Nair',
    initials: 'PN',
    color: '#5DCAA5',
    bg: '#5DCAA520',
    hasActiveChat: false,
  },
  {
    id: 'saved-4',
    name: 'Scarlett Jenner',
    initials: 'SJ',
    color: '#FF7AD1',
    bg: '#FF7AD120',
    hasActiveChat: true,
  },
  {
    id: 'saved-5',
    name: 'Michael Adams',
    initials: 'MA',
    color: '#6EE7FF',
    bg: '#6EE7FF20',
    hasActiveChat: true,
  },
];

const STARTED_KEY = 'ps-started-personal-chats';

export function loadStartedPersonalIds(email: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STARTED_KEY}:${email || 'guest'}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function markPersonalChatStarted(email: string, contactId: string): string[] {
  const list = [...new Set([...loadStartedPersonalIds(email), contactId])];
  if (typeof window !== 'undefined') {
    localStorage.setItem(`${STARTED_KEY}:${email || 'guest'}`, JSON.stringify(list));
  }
  return list;
}

export function savedWithoutActiveChat(
  email: string,
  activePersonalIds: Set<string>
): SavedContact[] {
  const started = new Set(loadStartedPersonalIds(email));
  return SAVED_PERSONAL_CONTACTS.filter((c) => {
    if (c.hasActiveChat) return false;
    if (started.has(c.id)) return false;
    if (activePersonalIds.has(c.id)) return false;
    return true;
  });
}

export function savedContactToUi(c: SavedContact): Contact {
  return {
    id: c.id,
    name: c.name,
    initials: c.initials,
    color: c.color,
    bg: c.bg,
    type: 'personal',
    preview: 'Start a conversation',
    time: '',
  };
}

export function resolveSavedOrDemo(id: string): Contact | undefined {
  const saved = SAVED_PERSONAL_CONTACTS.find((c) => c.id === id);
  if (saved) return savedContactToUi(saved);
  return DEMO_CONTACTS[id];
}
