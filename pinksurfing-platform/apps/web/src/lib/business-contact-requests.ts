import { joinContactViaQr } from '@/lib/qr-invite';
import type { DirectoryBusiness } from '@/lib/ps-business-directory';

export type BusinessContactRequest = {
  id: string;
  fromName: string;
  fromUserId?: string;
  toUserId?: string;
  toBusinessId: string;
  toBusinessName: string;
  toContactName: string;
  industry: string;
  industryCategory?: string;
  paychatId: string;
  message: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
  acceptedAt?: string;
};

const KEY = 'ps-business-contact-requests';
const ACCEPTED_SEEN_KEY = 'ps-business-request-accepted-seen';

function storageKey(email: string): string {
  return `${KEY}:${email || 'guest'}`;
}

function acceptedSeenKey(email: string): string {
  return `${ACCEPTED_SEEN_KEY}:${email || 'guest'}`;
}

function loadAcceptedSeenIds(email: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(acceptedSeenKey(email));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveAcceptedSeenIds(email: string, ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(acceptedSeenKey(email), JSON.stringify([...ids]));
}

export function loadBusinessRequests(email: string): BusinessContactRequest[] {
  if (typeof window === 'undefined') return seedIfEmpty(email);
  try {
    const raw = localStorage.getItem(storageKey(email));
    const list = raw ? (JSON.parse(raw) as BusinessContactRequest[]) : [];
    if (list.length === 0) return seedIfEmpty(email);
    return ensureDemoOutgoingSamples(email, list);
  } catch {
    return seedIfEmpty(email);
  }
}

function ensureDemoOutgoingSamples(
  email: string,
  list: BusinessContactRequest[]
): BusinessContactRequest[] {
  if (list.some((r) => r.toBusinessId !== 'me')) return list;
  const samples: BusinessContactRequest[] = [
    {
      id: 'req-out-demo-1',
      fromName: 'You',
      toBusinessId: 'dir-hvac',
      toBusinessName: 'Summit HVAC',
      toContactName: 'Alex Rivera',
      industry: 'HVAC',
      industryCategory: 'Construction & Real Estate',
      paychatId: 'PS-YOU',
      message: 'Request to connect with Summit HVAC via PinkSurfing search.',
      status: 'pending',
      createdAt: new Date(Date.now() - 3600_000 * 12).toISOString(),
    },
    {
      id: 'req-out-demo-2',
      fromName: 'You',
      toBusinessId: 'dir-design',
      toBusinessName: 'Studio North Design',
      toContactName: 'Casey Kim',
      industry: 'Interior Design',
      industryCategory: 'Construction & Real Estate',
      paychatId: 'PS-YOU',
      message: 'Request to connect with Studio North Design via PinkSurfing search.',
      status: 'pending',
      createdAt: new Date(Date.now() - 3600_000 * 48).toISOString(),
    },
  ];
  return saveBusinessRequests(email, [...samples, ...list]);
}

function saveBusinessRequests(email: string, list: BusinessContactRequest[]): BusinessContactRequest[] {
  if (typeof window !== 'undefined') {
    localStorage.setItem(storageKey(email), JSON.stringify(list));
  }
  return list;
}

function seedIfEmpty(email: string): BusinessContactRequest[] {
  const demo: BusinessContactRequest[] = [
    {
      id: 'req-in-1',
      fromName: 'Jordan Lee',
      toBusinessId: 'me',
      toBusinessName: 'Your business',
      toContactName: 'You',
      industry: 'Painting',
      industryCategory: 'Construction & Real Estate',
      paychatId: 'PS-JORDAN',
      message: 'Found you on PinkSurfing search — would like to connect for a project intro.',
      status: 'pending',
      createdAt: new Date(Date.now() - 3600_000 * 5).toISOString(),
    },
    {
      id: 'req-in-2',
      fromName: 'Morgan Tate',
      toBusinessId: 'me',
      toBusinessName: 'Your business',
      toContactName: 'You',
      industry: 'Consulting',
      industryCategory: 'Professional Services',
      paychatId: 'PS-MORGAN',
      message: 'Interested in your services. Happy to start on PayChat first.',
      status: 'pending',
      createdAt: new Date(Date.now() - 3600_000 * 28).toISOString(),
    },
    {
      id: 'req-out-demo-1',
      fromName: 'You',
      toBusinessId: 'dir-hvac',
      toBusinessName: 'Summit HVAC',
      toContactName: 'Alex Rivera',
      industry: 'HVAC',
      industryCategory: 'Construction & Real Estate',
      paychatId: 'PS-YOU',
      message: 'Request to connect with Summit HVAC via PinkSurfing search.',
      status: 'pending',
      createdAt: new Date(Date.now() - 3600_000 * 12).toISOString(),
    },
    {
      id: 'req-out-demo-2',
      fromName: 'You',
      toBusinessId: 'dir-design',
      toBusinessName: 'Studio North Design',
      toContactName: 'Casey Kim',
      industry: 'Interior Design',
      industryCategory: 'Construction & Real Estate',
      paychatId: 'PS-YOU',
      message: 'Request to connect with Studio North Design via PinkSurfing search.',
      status: 'pending',
      createdAt: new Date(Date.now() - 3600_000 * 48).toISOString(),
    },
  ];
  return saveBusinessRequests(email, demo);
}

export function incomingRequests(email: string): BusinessContactRequest[] {
  return loadBusinessRequests(email).filter((r) => r.status === 'pending' && r.toBusinessId === 'me');
}

export function outgoingRequests(email: string): BusinessContactRequest[] {
  return loadBusinessRequests(email)
    .filter((r) => r.toBusinessId !== 'me')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function pendingOutgoingRequests(email: string): BusinessContactRequest[] {
  return outgoingRequests(email).filter((r) => r.status === 'pending');
}

/** Outgoing requests newly accepted by the other party — not yet shown to the user. */
export function popUnnotifiedAcceptedOutgoing(email: string): BusinessContactRequest[] {
  const seen = loadAcceptedSeenIds(email);
  const fresh = loadBusinessRequests(email).filter(
    (r) => r.toBusinessId !== 'me' && r.status === 'approved' && !seen.has(r.id)
  );
  if (fresh.length === 0) return [];
  for (const r of fresh) seen.add(r.id);
  saveAcceptedSeenIds(email, seen);
  return fresh;
}

/** Demo: simulate the other party accepting your oldest pending outgoing request. */
export function runDemoOutgoingAcceptance(email: string): boolean {
  const pending = pendingOutgoingRequests(email);
  const target = pending.find((r) => r.id === 'req-out-demo-1') ?? pending[0];
  if (!target) return false;
  markOutgoingAccepted(email, target.id);
  return true;
}

function markOutgoingAccepted(email: string, requestId: string): BusinessContactRequest[] {
  const now = new Date().toISOString();
  const list = loadBusinessRequests(email).map((r) =>
    r.id === requestId ? { ...r, status: 'approved' as const, acceptedAt: now } : r
  );
  return saveBusinessRequests(email, list);
}

export function hasPendingRequest(email: string, businessId: string): boolean {
  return loadBusinessRequests(email).some(
    (r) => r.toBusinessId === businessId && r.status === 'pending'
  );
}

export function sendBusinessRequest(
  email: string,
  target: DirectoryBusiness,
  fromName: string,
  paychatId: string
): BusinessContactRequest[] {
  const list = loadBusinessRequests(email);
  if (hasPendingRequest(email, target.id)) return list;

  const entry: BusinessContactRequest = {
    id: `req-${Date.now()}`,
    fromName,
    toBusinessId: target.id,
    toBusinessName: target.businessName,
    toContactName: target.contactName,
    industry: target.industry,
    industryCategory: target.industryCategory,
    paychatId,
    message: `Request to connect with ${target.businessName} via PinkSurfing search.`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  return saveBusinessRequests(email, [entry, ...list]);
}

export function approveBusinessRequest(
  email: string,
  requestId: string,
  contactId?: string
): BusinessContactRequest[] {
  const now = new Date().toISOString();
  const list = loadBusinessRequests(email).map((r) =>
    r.id === requestId ? { ...r, status: 'approved' as const, acceptedAt: now } : r
  );
  if (contactId) joinContactViaQr('business', contactId);
  return saveBusinessRequests(email, list);
}

export function declineBusinessRequest(email: string, requestId: string): BusinessContactRequest[] {
  const list = loadBusinessRequests(email).map((r) =>
    r.id === requestId ? { ...r, status: 'declined' as const } : r
  );
  return saveBusinessRequests(email, list);
}

export function formatRequestWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3600_000;
  if (diffH < 24) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
