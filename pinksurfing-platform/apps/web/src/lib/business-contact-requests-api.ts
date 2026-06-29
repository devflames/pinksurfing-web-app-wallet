import { getApiBase } from './api-client';
import type { BusinessContactRequest } from './business-contact-requests';

const BASE = () => `${getApiBase()}/chat/chats/business-requests`;

type ListResponse = {
  status: string;
  data?: BusinessContactRequest[];
  message?: string;
};

type OneResponse = {
  status: string;
  data?: BusinessContactRequest;
  message?: string;
};

async function postJson<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const parsed = (await res.json().catch(() => ({}))) as T & { message?: string; status?: string };
  if (!res.ok) {
    throw new Error((parsed as { message?: string }).message || res.statusText);
  }
  if (parsed.status === 'error' || parsed.status === 'fail') {
    throw new Error((parsed as { message?: string }).message || 'Request failed');
  }
  return parsed;
}

export async function fetchBusinessRequests(token: string): Promise<BusinessContactRequest[]> {
  const res = await postJson<ListResponse>(token, '/list', {});
  return res.data ?? [];
}

export async function sendBusinessRequestApi(
  token: string,
  input: {
    toUserId: string;
    toBusinessId?: string;
    toBusinessName: string;
    toContactName?: string;
    industry?: string;
    industryCategory?: string;
    paychatId?: string;
    message?: string;
    fromName?: string;
  }
): Promise<BusinessContactRequest> {
  const res = await postJson<OneResponse>(token, '/send', input);
  if (!res.data) throw new Error(res.message || 'Send failed');
  return res.data;
}

export async function approveBusinessRequestApi(
  token: string,
  requestId: string
): Promise<BusinessContactRequest> {
  const res = await postJson<OneResponse>(token, '/approve', { requestId });
  if (!res.data) throw new Error(res.message || 'Approve failed');
  return res.data;
}

export async function declineBusinessRequestApi(
  token: string,
  requestId: string
): Promise<BusinessContactRequest> {
  const res = await postJson<OneResponse>(token, '/decline', { requestId });
  if (!res.data) throw new Error(res.message || 'Decline failed');
  return res.data;
}

export async function cancelBusinessRequestApi(
  token: string,
  requestId: string
): Promise<BusinessContactRequest> {
  const res = await postJson<OneResponse>(token, '/cancel', { requestId });
  if (!res.data) throw new Error(res.message || 'Cancel failed');
  return res.data;
}

export function inferViewerRole(
  request: BusinessContactRequest,
  userId: string | null | undefined
): 'incoming' | 'outgoing' | undefined {
  if (request.viewerRole) return request.viewerRole;
  if (!userId) return undefined;
  const uid = String(userId);
  if (request.fromUserId && String(request.fromUserId) === uid) return 'outgoing';
  if (request.toUserId && String(request.toUserId) === uid) return 'incoming';
  return undefined;
}

export function enrichBusinessRequests(
  requests: BusinessContactRequest[],
  userId: string | null | undefined
): BusinessContactRequest[] {
  return requests.map((r) => ({
    ...r,
    viewerRole: inferViewerRole(r, userId),
  }));
}

export function incomingRequestsLive(
  requests: BusinessContactRequest[],
  userId?: string | null
): BusinessContactRequest[] {
  const list = userId ? enrichBusinessRequests(requests, userId) : requests;
  return list.filter(
    (r) => r.status === 'pending' && r.viewerRole === 'incoming'
  );
}

export function outgoingRequestsLive(
  requests: BusinessContactRequest[],
  userId?: string | null
): BusinessContactRequest[] {
  const list = userId ? enrichBusinessRequests(requests, userId) : requests;
  return list
    .filter((r) => r.viewerRole === 'outgoing')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function hasPendingRequestLive(
  requests: BusinessContactRequest[],
  toUserId: string,
  userId?: string | null
): boolean {
  const list = userId ? enrichBusinessRequests(requests, userId) : requests;
  return list.some(
    (r) =>
      r.viewerRole === 'outgoing' &&
      r.toUserId === toUserId &&
      r.status === 'pending'
  );
}
