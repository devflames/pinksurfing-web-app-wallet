import { joinContactViaQr } from '@/lib/qr-invite';
import type { DirectoryBusiness } from '@/lib/ps-business-directory';

export type BusinessContactRequest = {
  id: string;
  fromName: string;
  toBusinessId: string;
  toBusinessName: string;
  toContactName: string;
  industry: string;
  industryCategory?: string;
  paychatId: string;
  message: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
};

const KEY = 'ps-business-contact-requests';

function storageKey(email: string): string {
  return `${KEY}:${email || 'guest'}`;
}

export function loadBusinessRequests(email: string): BusinessContactRequest[] {
  if (typeof window === 'undefined') return seedIfEmpty(email);
  try {
    const raw = localStorage.getItem(storageKey(email));
    const list = raw ? (JSON.parse(raw) as BusinessContactRequest[]) : [];
    if (list.length === 0) return seedIfEmpty(email);
    return list;
  } catch {
    return seedIfEmpty(email);
  }
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
  ];
  return saveBusinessRequests(email, demo);
}

export function incomingRequests(email: string): BusinessContactRequest[] {
  return loadBusinessRequests(email).filter((r) => r.status === 'pending' && r.toBusinessId === 'me');
}

export function outgoingRequests(email: string): BusinessContactRequest[] {
  return loadBusinessRequests(email).filter((r) => r.toBusinessId !== 'me');
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
  const list = loadBusinessRequests(email).map((r) =>
    r.id === requestId ? { ...r, status: 'approved' as const } : r
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
