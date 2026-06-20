import type { CallMode } from '@/lib/types/call';

export type CallHistoryEntry = {
  id: string;
  contactId: string;
  contactName: string;
  mode: CallMode;
  direction: 'outgoing' | 'incoming';
  durationSec: number;
  costUsd?: number;
  startedAt: string;
  status: 'completed' | 'missed' | 'failed';
};

const KEY = 'ps-call-history';
const MAX = 40;

function storageKey(email: string): string {
  return `${KEY}:${email || 'guest'}`;
}

export function loadCallHistory(email: string): CallHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(email));
    return raw ? (JSON.parse(raw) as CallHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendCallHistory(email: string, entry: CallHistoryEntry): CallHistoryEntry[] {
  const list = [entry, ...loadCallHistory(email)].slice(0, MAX);
  if (typeof window !== 'undefined') {
    localStorage.setItem(storageKey(email), JSON.stringify(list));
  }
  return list;
}

export function formatCallDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function formatCallWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const VIDEO_CALL_RATE_PER_MIN_USD = 0.1;

export function videoCallCost(durationSec: number): number {
  const minutes = Math.max(1, Math.ceil(durationSec / 60));
  return minutes * VIDEO_CALL_RATE_PER_MIN_USD;
}
