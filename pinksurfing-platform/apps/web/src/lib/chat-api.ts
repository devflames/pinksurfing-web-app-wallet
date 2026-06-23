import { getApiBase } from './api-client';
import type { Contact, ChatTab } from '@pinksurfing/ui';
import type { ThreadMessage } from './types/chat';

const CHAT_BASE = `${getApiBase()}/chat`;

export function isChatLive(): boolean {
  return process.env.NEXT_PUBLIC_CHAT_LIVE === 'true';
}

export type ApiContactRow = {
  id?: string;
  userId?: string;
  email?: string;
  contact?: string;
  chatType?: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  lastMessage?: string;
  lastSeen?: string;
  updatedAt?: string;
  isFav?: boolean;
};

type ContactListResponse = {
  status: string;
  contacts?: ApiContactRow[];
  message?: string;
};

type MessageBulkResponse = {
  status: string;
  accounts?: ApiMessageAccount[];
  message?: string;
};

type ApiMessageAccount = {
  _id?: string;
  from?: string;
  to?: string;
  chatType?: string;
  messages?: ApiMessageRow[];
  message?: string;
  createdAt?: string;
  last_modified_date?: string;
};

type ApiMessageRow = {
  _id?: string;
  from?: string;
  to?: string;
  message?: string;
  timestamp?: string | number;
};

type UploadResponse = {
  status: string | boolean;
  data?: { fileURL?: string };
  message?: string;
};

const AVATAR_PALETTE = [
  { color: '#FF7AD1', bg: '#FF7AD120' },
  { color: '#6EE7FF', bg: '#6EE7FF20' },
  { color: '#AFA9EC', bg: '#AFA9EC20' },
  { color: '#5DCAA5', bg: '#5DCAA520' },
  { color: '#EF9F27', bg: '#EF9F2720' },
];

function paletteFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[hash] ?? AVATAR_PALETTE[0];
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function chatTabFromApi(chatType?: string): ChatTab {
  const t = (chatType ?? 'personal').toLowerCase();
  if (t === 'business') return 'business';
  if (t === 'paychat') return 'paychat';
  return 'personal';
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatMsgTime(ts?: string | number): string {
  if (ts == null) return '';
  try {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function parseMessagePayload(raw?: string): { text?: string; attachment?: string } {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object') {
      return {
        text: (parsed.message ?? parsed.text) as string | undefined,
        attachment: parsed.attachment as string | undefined,
      };
    }
  } catch {
    // plain string
  }
  return { text: raw };
}

export function apiContactToContact(row: ApiContactRow, index: number): Contact {
  const backendId = row.userId ?? row.id ?? `api-${index}`;
  const name =
    [row.firstName, row.lastName].filter(Boolean).join(' ') ||
    row.contact ||
    row.email ||
    'Contact';
  const { color, bg } = paletteFor(backendId);
  const type = chatTabFromApi(row.chatType);
  return {
    id: `live-${backendId}`,
    userId: backendId,
    name,
    initials: initialsFrom(name),
    color,
    bg,
    type,
    preview: row.lastMessage ?? '',
    time: formatTime(row.updatedAt ?? row.lastSeen),
    biz: type === 'business',
  };
}

export async function fetchContactList(token: string): Promise<Contact[]> {
  const res = await fetch(`${CHAT_BASE}/users/contactList`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const body = (await res.json().catch(() => ({}))) as ContactListResponse;
  if (!res.ok || body.status !== 'success') {
    throw new Error(body.message ?? 'Failed to load contacts');
  }
  return (body.contacts ?? []).map(apiContactToContact);
}

export async function fetchOneToOneMessages(
  token: string,
  fromUserId: string,
  toUserId: string,
  chatType: string
): Promise<ThreadMessage[]> {
  const res = await fetch(`${CHAT_BASE}/chats/getOneToOneMessageBulk`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromUserId,
      to: toUserId,
      chatType,
      last_sync: '1990-01-01 12:00:00',
    }),
  });
  const body = (await res.json().catch(() => ({}))) as MessageBulkResponse;
  if (!res.ok || body.status !== 'success') {
    throw new Error(body.message ?? 'Failed to load messages');
  }
  return mapAccountsToThreadMessages(body.accounts ?? [], fromUserId);
}

function mapAccountsToThreadMessages(
  accounts: ApiMessageAccount[],
  selfUserId: string
): ThreadMessage[] {
  const rows: { ts: number; msg: ThreadMessage }[] = [];

  for (const account of accounts) {
    const nested = account.messages ?? [];
    if (nested.length > 0) {
      for (const m of nested) {
        const parsed = pushApiRow(m, selfUserId);
        if (parsed) rows.push(parsed);
      }
    } else if (account.message) {
      const synthetic: ApiMessageRow = {
        _id: account._id,
        from: account.from,
        to: account.to,
        message: account.message,
        timestamp: account.createdAt ?? account.last_modified_date,
      };
      const parsed = pushApiRow(synthetic, selfUserId);
      if (parsed) rows.push(parsed);
    }
  }

  rows.sort((a, b) => a.ts - b.ts);
  return rows.map((r) => r.msg);
}

function pushApiRow(
  m: ApiMessageRow,
  selfUserId: string
): { ts: number; msg: ThreadMessage } | null {
  const side: 'in' | 'out' = m.from === selfUserId ? 'out' : 'in';
  const { text, attachment } = parseMessagePayload(m.message);
  const time = formatMsgTime(m.timestamp);
  const id = m._id ?? `${m.from}-${m.timestamp}-${Math.random()}`;
  const ts =
    typeof m.timestamp === 'number'
      ? m.timestamp
      : m.timestamp
        ? new Date(m.timestamp).getTime()
        : Date.now();

  if (attachment) {
    return {
      ts,
      msg: {
        id,
        kind: 'attachment',
        side,
        attachmentUrl: attachment,
        fileName: attachment.split('/').pop(),
        text,
        time,
      },
    };
  }
  if (!text) return null;
  return {
    ts,
    msg: { id, kind: 'text', side, text, time, attachmentUrl: undefined },
  };
}

export async function sendChatMessage(
  token: string,
  fromUserId: string,
  toUserId: string,
  chatType: string,
  payload: { text?: string; attachmentUrl?: string }
): Promise<void> {
  const messageObj: Record<string, string> = {};
  if (payload.text) messageObj.message = payload.text;
  if (payload.attachmentUrl) messageObj.attachment = payload.attachmentUrl;

  const res = await fetch(`${CHAT_BASE}/chats/add`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromUserId,
      to: toUserId,
      chatType,
      group: '0',
      message: JSON.stringify(messageObj),
      timestamp: new Date().toISOString(),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
  if (!res.ok || body.status !== 'success') {
    throw new Error(body.message ?? 'Failed to send message');
  }
}

export async function uploadChatAttachment(token: string, file: File): Promise<string> {
  const form = new FormData();
  form.append('id_1', file);

  const res = await fetch(`${CHAT_BASE}/users/uploadAttachment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as UploadResponse;
  const ok = body.status === 'true' || body.status === true || body.status === 'success';
  const url = body.data?.fileURL;
  if (!res.ok || !ok || !url) {
    throw new Error(body.message ?? 'Upload failed');
  }
  return url;
}

type SimpleApiResponse = {
  status?: string;
  message?: string;
};

export async function addPaychatContactByPspayId(token: string, pspayId: string): Promise<void> {
  const res = await fetch(`${CHAT_BASE}/paychat/addContact`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pspay_id: pspayId }),
  });
  const body = (await res.json().catch(() => ({}))) as SimpleApiResponse;
  if (!res.ok || body.status !== 'success') {
    throw new Error(body.message ?? 'Could not add PayChat contact');
  }
}

export async function addBusinessContactByEmail(token: string, email: string): Promise<void> {
  const res = await fetch(`${CHAT_BASE}/users/addContact`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, type: 'business' }),
  });
  const body = (await res.json().catch(() => ({}))) as SimpleApiResponse;
  if (!res.ok || body.status !== 'success') {
    throw new Error(body.message ?? 'Could not add business contact');
  }
}

export function chatTypeForContact(contact: Contact): string {
  if (contact.type === 'business') return 'business';
  if (contact.type === 'paychat') return 'paychat';
  return 'personal';
}

export function peerUserIdForLiveContact(contact: Contact): string | null {
  if (contact.userId) return contact.userId;
  return null;
}
