export const colors = {
  bg: 'var(--ps-bg)',
  surf: 'var(--ps-surf)',
  card: 'var(--ps-card)',
  card2: 'var(--ps-card2)',
  brd: 'var(--ps-brd)',
  brd2: 'var(--ps-brd2)',
  primary: 'var(--ps-primary)',
  cyan: 'var(--ps-cyan)',
  pink: 'var(--ps-pink)',
  purple: 'var(--ps-purple)',
  green: 'var(--ps-green)',
  amber: 'var(--ps-amber)',
  red: 'var(--ps-red)',
  white: 'var(--ps-white)',
  muted: 'var(--ps-muted)',
  dim: 'var(--ps-dim)',
} as const;

export type ChatTab = 'personal' | 'business' | 'paychat';

export type AppSection = 'home' | 'paychat' | 'shop' | 'share' | 'explore' | 'me';

export type PaychatDirection = 'incoming' | 'outgoing';

export type Contact = {
  id: string;
  name: string;
  initials: string;
  color: string;
  bg: string;
  type: ChatTab;
  preview: string;
  time: string;
  unread?: number;
  biz?: boolean;
  unlocked?: boolean;
  askUsd?: number;
  /** incoming = they pay you · outgoing = you pay them */
  paychatDirection?: PaychatDirection;
  /** Raihan backend user id — used for live chat API calls */
  userId?: string;
  /** Group chat — opens Edit Teams when selected */
  isGroup?: boolean;
  groupId?: string;
  memberCount?: number;
};
