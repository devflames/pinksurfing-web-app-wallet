import { withBasePath } from '@/lib/base-path';

export type KycStatus =
  | 'none'
  | 'not_started'
  | 'in_progress'
  | 'in_review'
  | 'approved'
  | 'rejected';

export type IdentityStatus = {
  verified: boolean;
  status: KycStatus;
};

const KYC_CONTEXT = 'vendor';

function identityApiRoot(): string {
  const configured = process.env.NEXT_PUBLIC_IDENTITY_API_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/identity`;
  }
  return '/api/identity';
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

export async function fetchIdentityStatus(token: string): Promise<IdentityStatus> {
  const root = identityApiRoot();
  const res = await fetch(
    `${root}/status/?context=${encodeURIComponent(KYC_CONTEXT)}`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) {
    throw new Error(`Identity status failed (${res.status})`);
  }
  const data = (await res.json()) as {
    verified?: boolean;
    status?: string;
  };
  const raw = (data.status ?? 'not_started').toLowerCase().replace(/\s+/g, '_');
  const status = raw as KycStatus;
  return {
    verified: !!data.verified || status === 'approved',
    status,
  };
}

export type IdentitySession = {
  verified?: boolean;
  verification_url?: string;
  url?: string;
  session_id?: string;
};

export async function createIdentitySession(
  token: string,
  callbackUrl: string
): Promise<IdentitySession> {
  const root = identityApiRoot();
  const res = await fetch(`${root}/session/`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: KYC_CONTEXT,
      callback_url: callbackUrl,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as IdentitySession & {
    detail?: string;
    didit_error?: string;
  };
  if (!res.ok) {
    throw new Error(data.detail || data.didit_error || `Session failed (${res.status})`);
  }
  return data;
}

export function identityCallbackUrl(returnPath?: string): string {
  if (typeof window === 'undefined') return withBasePath('/identity/verify');
  const path = returnPath ?? `${window.location.pathname}${window.location.search}`;
  const verify = `${window.location.origin}${withBasePath('/identity/verify')}`;
  return `${verify}?returnUrl=${encodeURIComponent(path)}`;
}

export async function openDiditVerification(url: string): Promise<void> {
  const { DiditSdk } = await import('@didit-protocol/sdk-web');
  DiditSdk.shared.startVerification({ url });
}

export function isKycVerified(status: IdentityStatus | null): boolean {
  return !!status?.verified;
}

export function kycStatusLabel(status: KycStatus | undefined): string {
  switch (status) {
    case 'approved':
      return 'Certified';
    case 'in_progress':
    case 'in_review':
      return 'Verification in progress';
    case 'rejected':
      return 'Verification declined — tap to retry';
    default:
      return 'Verify identity to get certified';
  }
}
