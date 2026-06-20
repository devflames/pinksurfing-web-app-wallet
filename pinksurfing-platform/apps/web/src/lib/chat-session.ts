import { DEMO_MESSAGES } from './demo-data';
import type { ContactPreview, ThreadMessage } from './types/chat';
import type { BusinessCardSnapshot } from './business-card-types';

const STORAGE_KEY = 'ps-demo-threads-v1';
const PREVIEW_KEY = 'ps-demo-previews-v1';

function nowTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function seedThreads(): Record<string, ThreadMessage[]> {
  const out: Record<string, ThreadMessage[]> = {};
  for (const [contactId, msgs] of Object.entries(DEMO_MESSAGES)) {
    out[contactId] = msgs.map((m) => ({
      id: uid(),
      kind: 'text' as const,
      side: m.side,
      text: m.text,
      time: m.time,
    }));
  }
  return out;
}

function loadThreads(): Record<string, ThreadMessage[]> {
  if (typeof window === 'undefined') return seedThreads();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedThreads();
    return JSON.parse(raw) as Record<string, ThreadMessage[]>;
  } catch {
    return seedThreads();
  }
}

function saveThreads(threads: Record<string, ThreadMessage[]>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
}

function loadPreviews(): Record<string, ContactPreview> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PREVIEW_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ContactPreview>) : {};
  } catch {
    return {};
  }
}

function savePreviews(previews: Record<string, ContactPreview>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREVIEW_KEY, JSON.stringify(previews));
}

const AUTO_REPLIES = [
  'Got it!',
  'Understood.',
  'Will do.',
  'Thanks for the update.',
  'On it.',
];

export function resetDemoSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PREVIEW_KEY);
  localStorage.removeItem('ps-business-qr-verified');
}

export class ChatSessionStore {
  private threads: Record<string, ThreadMessage[]>;
  private previews: Record<string, ContactPreview>;
  private listeners = new Set<() => void>();

  constructor() {
    this.threads = loadThreads();
    this.previews = loadPreviews();
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    saveThreads(this.threads);
    savePreviews(this.previews);
    this.listeners.forEach((fn) => fn());
  }

  getMessages(contactId: string): ThreadMessage[] {
    if (!this.threads[contactId]) {
      this.threads[contactId] = [];
    }
    return this.threads[contactId];
  }

  getPreview(contactId: string, fallback: string): ContactPreview {
    return this.previews[contactId] ?? { preview: fallback, time: nowTime() };
  }

  sendMessage(contactId: string, text: string, onAutoReply?: (reply: string) => void) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const msg: ThreadMessage = {
      id: uid(),
      kind: 'text',
      side: 'out',
      text: trimmed,
      time: nowTime(),
    };
    this.threads[contactId] = [...this.getMessages(contactId), msg];
    this.previews[contactId] = { preview: trimmed, time: msg.time };
    this.emit();

    window.setTimeout(() => {
      const reply =
        AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)] ?? 'Got it!';
      const inMsg: ThreadMessage = {
        id: uid(),
        kind: 'text',
        side: 'in',
        text: reply,
        time: nowTime(),
      };
      this.threads[contactId] = [...this.getMessages(contactId), inMsg];
      this.previews[contactId] = { preview: reply, time: inMsg.time };
      this.emit();
      onAutoReply?.(reply);
    }, 900 + Math.random() * 600);
  }

  appendStateEvent(
    contactId: string,
    label: string,
    accent: string,
    contractTitle?: string
  ) {
    const msg: ThreadMessage = {
      id: uid(),
      kind: 'state',
      label,
      accent,
      contractTitle,
      time: nowTime(),
    };
    this.threads[contactId] = [...this.getMessages(contactId), msg];
    this.previews[contactId] = { preview: label, time: msg.time };
    this.emit();
  }

  appendSystemText(contactId: string, text: string) {
    const msg: ThreadMessage = {
      id: uid(),
      kind: 'text',
      side: 'in',
      text,
      time: nowTime(),
    };
    this.threads[contactId] = [...this.getMessages(contactId), msg];
    this.previews[contactId] = { preview: text.slice(0, 40), time: msg.time };
    this.emit();
  }

  sendAttachment(
    contactId: string,
    attachmentUrl: string,
    fileName: string,
    caption?: string
  ) {
    const isAudio = /\.(webm|mp3|m4a|ogg|wav)(\?|$)/i.test(fileName) || fileName.startsWith('voice-');
    const msg: ThreadMessage = {
      id: uid(),
      kind: 'attachment',
      side: 'out',
      attachmentUrl,
      fileName,
      text: caption ?? (isAudio ? '🎤 Voice message' : undefined),
      time: nowTime(),
    };
    this.threads[contactId] = [...this.getMessages(contactId), msg];
    this.previews[contactId] = {
      preview: isAudio ? '🎤 Voice message' : `📎 ${fileName}`,
      time: msg.time,
    };
    this.emit();

    window.setTimeout(() => {
      const reply = isAudio ? 'Voice message received.' : 'File received.';
      const inMsg: ThreadMessage = {
        id: uid(),
        kind: 'text',
        side: 'in',
        text: reply,
        time: nowTime(),
      };
      this.threads[contactId] = [...this.getMessages(contactId), inMsg];
      this.previews[contactId] = { preview: reply, time: inMsg.time };
      this.emit();
    }, 900 + Math.random() * 600);
  }

  sendBusinessCard(contactId: string, card: BusinessCardSnapshot) {
    const title = card.displayName;
    const msg: ThreadMessage = {
      id: uid(),
      kind: 'bizcard',
      side: 'out',
      card,
      time: nowTime(),
    };
    this.threads[contactId] = [...this.getMessages(contactId), msg];
    this.previews[contactId] = { preview: `🪪 Business card — ${title}`, time: msg.time };
    this.emit();
  }
}

let singleton: ChatSessionStore | null = null;

export function getChatSession(): ChatSessionStore {
  if (!singleton) singleton = new ChatSessionStore();
  return singleton;
}

export const STATE_EVENT_LABELS: Record<string, { label: string; accent: string }> = {
  DRAFT: { label: '⚡ Offer sent', accent: '#EF9F27' },
  PENDING_APPROVAL: { label: '⚡ Offer sent', accent: '#EF9F27' },
  APPROVED: { label: '✔ Approved', accent: '#5DCAA5' },
  PAID_OFF_PLATFORM: { label: '✔ Paid off-platform', accent: '#6EE7FF' },
  ESCROW_FUNDING_INITIATED: { label: '⏳ Escrow funding', accent: '#EF9F27' },
  ESCROW_FUNDED: { label: '✔ Funds reserved', accent: '#6EE7FF' },
  IN_PROGRESS: { label: '⏳ Work in progress', accent: '#FF7AD1' },
  EVIDENCE_SUBMITTED: { label: '📎 Evidence submitted', accent: '#AFA9EC' },
  VERIFIED: { label: '✔ Verified', accent: '#5DCAA5' },
  COMPLETED: { label: '✔ Settled', accent: '#5DCAA5' },
  DISPUTED: { label: '⚠ Dispute opened', accent: '#E24B4A' },
  CANCELLED: { label: 'Cancelled', accent: '#6B4C80' },
  LAPSED: { label: 'Lapsed', accent: '#6B4C80' },
};
