import { apiFetch, getApiBase } from './api-client';
import type {
  CallInitiateResponse,
  CallMode,
  CallRecord,
  CallStatusResponse,
  RtcTokenResponse,
} from './types/call';

const base = () => getApiBase();

/** Raihan mobileapi — GET /rtc/:channel/:role/:tokentype/:uid (via gateway /api/app/rtc/...) */
export async function fetchRtcToken(
  channel: string,
  uid: number,
  role: 'publisher' | 'audience' = 'publisher'
): Promise<string> {
  const path = `${base()}/rtc/${encodeURIComponent(channel)}/${role}/uid/${uid}`;
  const res = await fetch(path);
  const body = (await res.json().catch(() => ({}))) as RtcTokenResponse;
  if (!res.ok || !body.rtcToken) {
    throw new Error(body.error || `RTC token failed (${res.status})`);
  }
  return body.rtcToken;
}

/** Raihan chat — GET /chat/calls/status */
export async function fetchCallStatus(token: string): Promise<CallRecord[]> {
  const body = await apiFetch<CallStatusResponse>(`${base()}/chat/calls/status`, { token });
  return body.data ?? [];
}

/** Raihan chat — POST /chat/calls/initiate */
export async function initiateCall(
  token: string,
  input: {
    from: string;
    to: string;
    mode: CallMode;
    chatType: 'personal' | 'business';
    message?: string;
    groupId?: string;
    groupName?: string;
  }
): Promise<string> {
  const isGroup = !!(input.groupId && input.groupId !== '0');
  const notificationType = input.mode === 'video' ? 5 : 4;

  const payload: Record<string, unknown> = {
    from: input.from,
    to: input.to,
    notification_type: notificationType,
    message:
      input.message ??
      `${isGroup ? 'Group ' : ''}${input.mode === 'video' ? 'Video' : 'Voice'} call initiated`,
    type: input.mode,
    chatType: input.chatType,
  };

  if (isGroup) {
    payload.group_id = input.groupId;
    payload.group_name = input.groupName ?? 'Group';
  }

  const body = await apiFetch<CallInitiateResponse>(`${base()}/chat/calls/initiate`, {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });

  const ok =
    body.status === true ||
    body.status === 'success' ||
    (typeof body.status === 'boolean' && body.status);

  const channel = body.data?.channel;
  if (!ok || !channel) {
    throw new Error(body.message || 'Call initiation failed');
  }
  return channel;
}

/** Raihan chat — POST /chat/calls/accept */
export async function acceptCall(token: string, channel: string): Promise<CallRecord> {
  const body = await apiFetch<{ status?: boolean; data?: CallRecord; message?: string }>(
    `${base()}/chat/calls/accept`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ channel }),
    }
  );
  if (body.status !== true || !body.data?.channel) {
    throw new Error(body.message || 'Could not accept call');
  }
  return body.data;
}

/** Raihan chat — POST /chat/calls/reject */
export async function rejectCall(
  token: string,
  channel: string,
  groupId = '0'
): Promise<void> {
  await apiFetch(`${base()}/chat/calls/reject`, {
    method: 'POST',
    token,
    body: JSON.stringify({ channel, group_id: groupId }),
  });
}

/** Raihan chat — POST /chat/calls/end */
export async function endCall(token: string, channel: string, groupId = '0'): Promise<void> {
  await apiFetch(`${base()}/chat/calls/end`, {
    method: 'POST',
    token,
    body: JSON.stringify({ channel, group_id: groupId }),
  });
}

/** Demo fallback when full Raihan chat stack is unavailable */
export function buildDemoChannel(from: string, to: string): string {
  const stamp = Date.now().toString(36);
  return `ps-web-${from.slice(0, 8)}-${to.slice(0, 8)}-${stamp}`;
}

export function agoraUidFromUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 900000) + 10000;
}

export function callModeFromRecord(record: CallRecord): CallMode {
  const mode = (record.call_mode ?? '').toLowerCase();
  if (mode === 'video') return 'video';
  const type = String(record.type ?? '');
  if (type === '5' || type === '6') return 'video';
  return 'voice';
}

export function incomingCallFromRecord(
  record: CallRecord,
  selfUserId: string
): import('./types/call').IncomingCall | null {
  if (!record.channel || record.call_status !== '1' || record.from === selfUserId) {
    return null;
  }

  const groupId = record.group_id;
  const isGroup = !!(groupId && groupId !== '0');
  const isDirectRecipient = record.to === selfUserId;

  if (!isGroup && !isDirectRecipient) return null;

  return {
    channel: record.channel,
    from: record.from ?? '',
    to: record.to ?? '',
    mode: callModeFromRecord(record),
    callerName: record.maker_name?.trim() || 'Incoming call',
    chatType: record.chatType === 'business' ? 'business' : 'personal',
    isGroup,
    groupId: isGroup ? groupId : undefined,
    groupName: record.group_name,
    notificationType: record.type,
  };
}
