const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:8080/api/app';

const WALLET_BASE =
  process.env.NEXT_PUBLIC_WALLET_URL?.replace(/\/$/, '') || 'http://localhost:8080/api/wallet';

const CONTRACTS_BASE = `${API_BASE}/chat/chats/contracts`;

export function getApiBase(): string {
  return API_BASE;
}

export function getWalletBase(): string {
  return WALLET_BASE;
}

export function getContractsBase(): string {
  return CONTRACTS_BASE;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;
  const headers = new Headers(customHeaders);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...rest, headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (body as { message?: string }).message || res.statusText;
    throw new Error(msg);
  }
  return body as T;
}
