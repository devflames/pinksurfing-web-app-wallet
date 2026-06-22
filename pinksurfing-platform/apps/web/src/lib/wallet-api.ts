import { getWalletBase } from './api-client';
import type {
  AtomicSwap,
  KeyVaultLookup,
  KeyVaultStatus,
  WalletHealth,
  WalletProvisionStatus,
} from './types/wallet';

const base = () => getWalletBase();

async function walletFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const body = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) {
    const msg = (body as { message?: string }).message || res.statusText;
    throw new Error(msg);
  }
  return body;
}

export async function fetchWalletInfo(): Promise<WalletHealth> {
  const info = await walletFetch<{ name?: string; version?: string }>(`${base()}/`);
  let keyvault: WalletHealth['keyvault'];
  try {
    keyvault = await walletFetch(`${base()}/keyvault/health`);
  } catch {
    keyvault = undefined;
  }
  return { ...info, keyvault };
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchWalletStatus(token: string): Promise<WalletProvisionStatus> {
  return walletFetch<WalletProvisionStatus>(`${base()}/wallet/status`, {
    headers: authHeaders(token),
  });
}

export type LinkWalletPayload = {
  chiaAddress: string;
  walletPk: string;
  launcherId?: string;
};

export async function linkWalletToSso(
  token: string,
  payload: LinkWalletPayload
): Promise<WalletProvisionStatus> {
  return walletFetch<WalletProvisionStatus>(`${base()}/wallet/link`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export type KeyVaultAutoCreateResult = {
  success: boolean;
  launcherId?: string;
  ipfsCid?: string;
  deployPending?: boolean;
  message?: string;
};

export async function createKeyVaultAuto(payload: {
  ownerPubkeyHex: string;
  encryptedBackup: string;
  walletAddress: string;
}): Promise<KeyVaultAutoCreateResult> {
  const res = await fetch(`${base()}/keyvault/create-auto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return (await res.json().catch(() => ({}))) as KeyVaultAutoCreateResult;
}

export async function registerWalletProfile(
  body: {
    chiaAddress: string;
    walletPk: string;
    displayName?: string;
    profileData: Record<string, unknown>;
  },
  ed25519Headers: Record<string, string>
): Promise<void> {
  await walletFetch(`${base()}/profiles/register`, {
    method: 'POST',
    headers: ed25519Headers,
    body: JSON.stringify(body),
  });
}

export async function fetchOpenSwaps(limit = 20): Promise<AtomicSwap[]> {
  const res = await walletFetch<{ status: string; data?: AtomicSwap[] }>(
    `${base()}/swaps/open?limit=${limit}`
  );
  return res.data ?? [];
}

export async function fetchSwapsForAddress(address: string, limit = 20): Promise<AtomicSwap[]> {
  const encoded = encodeURIComponent(address);
  const res = await walletFetch<{ status: string; data?: AtomicSwap[] }>(
    `${base()}/swaps/address/${encoded}?limit=${limit}`
  );
  return res.data ?? [];
}

export async function lookupKeyVault(walletAddress: string): Promise<KeyVaultLookup> {
  const encoded = encodeURIComponent(walletAddress);
  return walletFetch<KeyVaultLookup>(`${base()}/keyvault/lookup/${encoded}`);
}

export async function fetchKeyVaultStatus(launcherId: string): Promise<KeyVaultStatus> {
  const encoded = encodeURIComponent(launcherId);
  return walletFetch<KeyVaultStatus>(`${base()}/keyvault/status/${encoded}`);
}

export type CreateSwapPayload = {
  initiatorChiaAddress: string;
  initiatorBtcPubkey?: string;
  direction: 'xch_to_btc' | 'btc_to_xch';
  xchAmountMojos: string;
  btcAmountSats: string;
  chiaClawbackPubkey?: string;
  btcClaimPubkey?: string;
};

export type CreateSwapResult = {
  swap: AtomicSwap;
  secret?: string;
};

export async function createAtomicSwap(
  payload: CreateSwapPayload,
  token?: string | null
): Promise<CreateSwapResult> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await walletFetch<{ status: string; data?: CreateSwapResult }>(`${base()}/swaps/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.data?.swap) {
    throw new Error('Swap create returned no data');
  }
  return res.data;
}

export async function acceptAtomicSwap(
  swapId: string,
  body: { counterpartyChiaAddress: string; counterpartyBtcPubkey?: string },
  token?: string | null
): Promise<AtomicSwap> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await walletFetch<{ status: string; data?: AtomicSwap }>(
    `${base()}/swaps/${encodeURIComponent(swapId)}/accept`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }
  );
  if (!res.data) throw new Error('Swap accept returned no data');
  return res.data;
}

export function formatXch(mojos: string | number): string {
  const n = typeof mojos === 'string' ? Number(mojos) : mojos;
  if (!Number.isFinite(n)) return String(mojos);
  return (n / 1_000_000_000_000).toFixed(4);
}

export function formatBtc(sats: string | number): string {
  const n = typeof sats === 'string' ? Number(sats) : sats;
  if (!Number.isFinite(n)) return String(sats);
  return (n / 100_000_000).toFixed(8);
}
