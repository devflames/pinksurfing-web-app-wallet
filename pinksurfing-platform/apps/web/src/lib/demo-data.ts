import type { Contact, ChatTab } from '@pinksurfing/ui';

export const DEMO_CONTACTS: Record<string, Contact> = {
  c1: {
    id: 'c1',
    name: 'Scarlett Jenner',
    initials: 'SJ',
    color: '#FF7AD1',
    bg: '#FF7AD120',
    type: 'personal',
    preview: 'sounds good!',
    time: '2m',
  },
  c2: {
    id: 'c2',
    name: 'Michael Adams',
    initials: 'MA',
    color: '#6EE7FF',
    bg: '#6EE7FF20',
    type: 'personal',
    preview: 'Thursday works',
    time: '1h',
    unread: 2,
  },
  c3: {
    id: 'c3',
    name: 'Paint Exterior',
    initials: 'SJ',
    color: '#AFA9EC',
    bg: '#AFA9EC20',
    type: 'business',
    preview: '✔ Approved',
    time: '20m',
    unread: 1,
    biz: true,
  },
  c4: {
    id: 'c4',
    name: 'Solar Install Co.',
    initials: 'SI',
    color: '#5DCAA5',
    bg: '#5DCAA520',
    type: 'business',
    preview: '⏳ Executing',
    time: '1h',
    biz: true,
  },
  c5: {
    id: 'c5',
    name: 'Alex Doins',
    initials: 'AD',
    color: '#EF9F27',
    bg: '#EF9F2720',
    type: 'business',
    preview: '⚠ Disputed',
    time: '1d',
    biz: true,
  },
  c6: {
    id: 'c6',
    name: 'Sarah Kim',
    initials: 'SK',
    color: '#FF7AD1',
    bg: '#FF7AD120',
    type: 'paychat',
    paychatDirection: 'outgoing',
    askUsd: 8.5,
    preview: 'Scan card to unlock',
    time: '',
  },
  c7: {
    id: 'c7',
    name: 'David Chen',
    initials: 'DC',
    color: '#6EE7FF',
    bg: '#6EE7FF20',
    type: 'paychat',
    paychatDirection: 'outgoing',
    unlocked: true,
    preview: 'Happy to connect!',
    time: '3h',
  },
  c8: {
    id: 'c8',
    name: 'Jordan Lee',
    initials: 'JL',
    color: '#5DCAA5',
    bg: '#5DCAA520',
    type: 'paychat',
    paychatDirection: 'incoming',
    unlocked: true,
    preview: 'Thanks for the intro!',
    time: '1h',
    unread: 1,
  },
  c9: {
    id: 'c9',
    name: 'Morgan Tate',
    initials: 'MT',
    color: '#AFA9EC',
    bg: '#AFA9EC20',
    type: 'paychat',
    paychatDirection: 'incoming',
    unlocked: true,
    preview: 'Following up on your offer',
    time: '2d',
  },
  g1: {
    id: 'g1',
    name: 'Team 1: FedEx',
    initials: 'Fx',
    color: '#4a90d9',
    bg: '#4a90d920',
    type: 'business',
    isGroup: true,
    groupId: 'grp-fedex',
    memberCount: 5,
    preview: 'Dispatcher: Route confirmed',
    time: '5m',
    unread: 2,
    biz: true,
  },
  g2: {
    id: 'g2',
    name: 'Paint Exterior Crew',
    initials: 'PE',
    color: '#AFA9EC',
    bg: '#AFA9EC20',
    type: 'business',
    isGroup: true,
    groupId: 'grp-paint',
    memberCount: 3,
    preview: 'Scarlett: Stucco samples approved',
    time: '1h',
    biz: true,
  },
};

/** Business QR invite codes — scan card to add exclusive business chat */
export const BUSINESS_QR_CODES: Record<string, { contactId: string; label: string }> = {
  'PAINT-2024': { contactId: 'c3', label: 'Paint Exterior job' },
  'SOLAR-24': { contactId: 'c4', label: 'Solar Install Co.' },
  'DECK-BUILD': { contactId: 'c5', label: 'Alex Doins — Deck build' },
};

/** PayChat QR codes — scan card to unlock exclusive PayChat */
export const PAYCHAT_QR_CODES: Record<string, { contactId: string; label: string }> = {
  'PS-KIM-85': { contactId: 'c6', label: 'Sarah Kim' },
  'PS-CHEN-7': { contactId: 'c7', label: 'David Chen' },
};

export const DEMO_MESSAGES: Record<string, { side: 'in' | 'out'; text: string; time: string }[]> = {
  c1: [
    { side: 'in', text: 'Hey! How are you?', time: '2:41pm' },
    { side: 'out', text: 'Great! Finished the mockups.', time: '2:43pm' },
    { side: 'in', text: 'Can you send them over?', time: '2:44pm' },
    { side: 'out', text: 'Sending now!', time: '2:45pm' },
    { side: 'in', text: 'sounds good!', time: '2:46pm' },
  ],
  c2: [
    { side: 'in', text: 'Can we catch up this week?', time: '10:21am' },
    { side: 'out', text: 'Thursday works for me.', time: '10:45am' },
  ],
  c3: [
    { side: 'in', text: 'Can you paint my house exterior for $4,000 by May 12?', time: '3:31pm' },
    { side: 'out', text: 'Yes — prep, prime, 2 coats, includes trim.', time: '3:33pm' },
    { side: 'in', text: 'Please proceed when payment is confirmed.', time: '3:38pm' },
  ],
  c4: [
    { side: 'in', text: 'Ready to start the solar install.', time: '9:10am' },
    { side: 'out', text: 'Gate code is 4821.', time: '9:15am' },
  ],
  c5: [
    { side: 'in', text: 'The materials were not what we agreed.', time: '2:00pm' },
    { side: 'out', text: 'I used the specified grade of lumber.', time: '2:10pm' },
  ],
  c7: [
    { side: 'in', text: 'Thanks for unlocking! Happy to connect.', time: '3:00pm' },
    { side: 'out', text: 'Looking forward to it.', time: '3:05pm' },
  ],
  c8: [
    { side: 'in', text: 'Paid to connect — thanks for making yourself available.', time: '11:00am' },
    { side: 'out', text: 'Happy to help. What do you need?', time: '11:05am' },
    { side: 'in', text: 'Thanks for the intro!', time: '11:10am' },
  ],
  c9: [
    { side: 'in', text: 'Following up on your offer from last week.', time: '9:30am' },
  ],
  g1: [
    { side: 'in', text: 'Route 42 confirmed — 12 stops today.', time: '8:10am' },
    { side: 'out', text: 'Copy. Team is loaded and rolling.', time: '8:12am' },
    { side: 'in', text: 'Dispatcher: Route confirmed for afternoon pickup.', time: '8:45am' },
  ],
  g2: [
    { side: 'in', text: 'Stucco samples approved — ordering materials.', time: '2:00pm' },
    { side: 'out', text: 'Great. Crew on site Thursday.', time: '2:05pm' },
  ],
};

export function contactsForTab(tab: ChatTab): Contact[] {
  return Object.values(DEMO_CONTACTS).filter((c) => c.type === tab);
}

export const BUSINESS_CONVERSATIONS: Record<
  string,
  { conversationId: string; counterpartyUserId: string }
> = {
  c3: { conversationId: 'conv-paint-exterior', counterpartyUserId: 'web-user-b' },
  c4: { conversationId: 'conv-solar-install', counterpartyUserId: 'web-user-b' },
  c5: { conversationId: 'conv-deck-build', counterpartyUserId: 'web-user-b' },
  g1: { conversationId: 'conv-team-fedex', counterpartyUserId: 'web-user-b' },
  g2: { conversationId: 'conv-team-paint', counterpartyUserId: 'web-user-b' },
};

/** Demo peer Mongo user ids for 1:1 calls (matches smoke JWT users) */
export const PERSONAL_PEER_USER_IDS: Record<string, string> = {
  c1: 'web-user-b',
  c2: 'web-user-c',
  c6: 'web-user-b',
  c7: 'web-user-c',
};

export function businessConversationForContact(contactId: string) {
  return BUSINESS_CONVERSATIONS[contactId] ?? null;
}

export function peerUserIdForContact(contactId: string): string | null {
  const biz = BUSINESS_CONVERSATIONS[contactId];
  if (biz) return biz.counterpartyUserId;
  return PERSONAL_PEER_USER_IDS[contactId] ?? null;
}
