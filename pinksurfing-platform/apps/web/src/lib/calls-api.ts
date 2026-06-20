import { apiFetch, getApiBase } from './api-client';
import type { CallInitiateResponse, CallMode, RtcTokenResponse } from './types/call';

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

/** Raihan chat — POST /chat/calls/initiate (Flutter parity) */
export async function initiateCall(
  token: string,
  input: {
    from: string;
    to: string;
    mode: CallMode;
    chatType: 'personal' | 'business';
    message?: string;
  }
): Promise<string> {
  const body = await apiFetch<CallInitiateResponse>(`${base()}/chat/calls/initiate`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      notification_type: input.mode === 'video' ? 5 : 4,
      message: input.message ?? `${input.mode === 'video' ? 'Video' : 'Voice'} call initiated`,
      type: input.mode,
      chatType: input.chatType,
    }),
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

/** Raihan chat — POST /chat/calls/end */
export async function endCall(token: string, channel: string): Promise<void> {
  await apiFetch(`${base()}/chat/calls/end`, {
    method: 'POST',
    token,
    body: JSON.stringify({ channel }),
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
