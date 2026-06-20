export type PhoneBookContact = {
  id: string;
  name: string;
  phone: string;
  onPinkSurfing: boolean;
};

export const DEMO_PHONE_BOOK: PhoneBookContact[] = [
  { id: 'pb-1', name: 'Jamie Brooks', phone: '(512) 555-0142', onPinkSurfing: false },
  { id: 'pb-2', name: 'Taylor Reed', phone: '(214) 555-0199', onPinkSurfing: false },
  { id: 'pb-3', name: 'Pat Olsen', phone: '(713) 555-0166', onPinkSurfing: true },
  { id: 'pb-4', name: 'Casey Wu', phone: '(415) 555-0133', onPinkSurfing: false },
];

export function pinksurfingInviteUrl(inviterName: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://pinksurfing.com';
  const q = encodeURIComponent(inviterName);
  return `${base}/invite?from=${q}`;
}

export function inviteMessage(name: string, inviterName: string): string {
  const url = pinksurfingInviteUrl(inviterName);
  return `Hey ${name} — join me on PinkSurfing: ${url}`;
}

export function filterPhoneBook(query: string): PhoneBookContact[] {
  const q = query.trim().toLowerCase();
  if (!q) return DEMO_PHONE_BOOK;
  return DEMO_PHONE_BOOK.filter(
    (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
  );
}
