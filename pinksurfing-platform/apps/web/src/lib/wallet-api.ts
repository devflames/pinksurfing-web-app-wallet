import { getWalletBase } from './api-client';
import { buildWalletAuthHeaders } from './wallet-ed25519-auth';
import type {
  AtomicSwap,
  KeyVaultLookup,
  KeyVaultStatus,
  WalletHealth,
  WalletProvisionStatus,
} from './types/wallet';

export type WalletCallerAuth = {
  chiaAddress: string;
  signingSk: Uint8Array;
};

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

async function authedSwapFetch<T>(
  auth: WalletCallerAuth,
  method: string,
  routerPath: string,
  body?: unknown
): Promise<T> {
  const headers = await buildWalletAuthHeaders(
    auth.chiaAddress,
    auth.signingSk,
    method,
    routerPath
  );
  const url = `${base()}/swaps${routerPath}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const parsed = (await res.json().catch(() => ({}))) as T & {
    status?: string;
    message?: string;
  };
  if (!res.ok || parsed.status === 'error') {
    throw new Error(parsed.message || res.statusText);
  }
  return parsed;
}

export async function createAtomicSwap(
  payload: CreateSwapPayload,
  auth: WalletCallerAuth
): Promise<CreateSwapResult> {
  const res = await authedSwapFetch<{ status: string; data?: CreateSwapResult; message?: string }>(
    auth,
    'POST',
    '/create',
    payload
  );
  if (!res.data?.swap) {
    throw new Error('Swap create returned no data');
  }
  return res.data;
}

export type AcceptSwapPayload = {
  counterpartyChiaAddress: string;
  counterpartyBtcPubkey?: string;
  chiaSweepPubkey?: string;
  btcRefundPubkey?: string;
  btcHtlcAddress?: string;
  btcHtlcRedeemScript?: string;
  btcHtlcFundingTxid?: string;
};

export async function acceptAtomicSwap(
  swapId: string,
  body: AcceptSwapPayload,
  auth: WalletCallerAuth
): Promise<AtomicSwap> {
  const res = await authedSwapFetch<{ status: string; data?: AtomicSwap; message?: string }>(
    auth,
    'POST',
    `/${encodeURIComponent(swapId)}/accept`,
    body
  );
  if (!res.data) throw new Error('Swap accept returned no data');
  return res.data;
}

export async function claimAtomicSwap(swapId: string, auth: WalletCallerAuth): Promise<AtomicSwap> {
  const res = await authedSwapFetch<{ status: string; data?: AtomicSwap }>(
    auth,
    'POST',
    `/${encodeURIComponent(swapId)}/claim`
  );
  if (!res.data) throw new Error('Swap claim returned no data');
  return res.data;
}

export async function completeAtomicSwap(
  swapId: string,
  auth: WalletCallerAuth
): Promise<AtomicSwap> {
  const res = await authedSwapFetch<{ status: string; data?: AtomicSwap }>(
    auth,
    'POST',
    `/${encodeURIComponent(swapId)}/complete`
  );
  if (!res.data) throw new Error('Swap complete returned no data');
  return res.data;
}

export async function refundAtomicSwap(swapId: string, auth: WalletCallerAuth): Promise<AtomicSwap> {
  const res = await authedSwapFetch<{ status: string; data?: AtomicSwap }>(
    auth,
    'POST',
    `/${encodeURIComponent(swapId)}/refund`
  );
  if (!res.data) throw new Error('Swap refund returned no data');
  return res.data;
}

export async function cancelAtomicSwap(swapId: string, auth: WalletCallerAuth): Promise<AtomicSwap> {
  const res = await authedSwapFetch<{ status: string; data?: AtomicSwap }>(
    auth,
    'POST',
    `/${encodeURIComponent(swapId)}/cancel`
  );
  if (!res.data) throw new Error('Swap cancel returned no data');
  return res.data;
}

export async function updateSwapChiaHtlc(
  swapId: string,
  body: { puzzleHash: string; address: string; coinId: string }
): Promise<AtomicSwap> {
  const res = await walletFetch<{ status: string; data?: AtomicSwap; message?: string }>(
    `${base()}/swaps/${encodeURIComponent(swapId)}/chia-htlc`,
    { method: 'POST', body: JSON.stringify(body) }
  );
  if (!res.data) throw new Error('Chia HTLC update returned no data');
  return res.data;
}

export async function fetchSwapById(swapId: string): Promise<AtomicSwap | null> {
  try {
    const res = await walletFetch<{ status: string; data?: AtomicSwap }>(
      `${base()}/swaps/${encodeURIComponent(swapId)}`
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

export type VaultBalance = {
  success: boolean;
  totalBalance?: number;
  coinCount?: number;
  depositAddress?: string;
  message?: string;
};

export type KeyVaultRecoverResult = {
  success: boolean;
  state?: {
    owner_pubkey?: string;
    all_cid_hashes?: string[];
    latest_cid_hash?: string;
    backup_count?: number;
  };
  message?: string;
};

export type PreparedVaultWithdraw = {
  success: boolean;
  coinSpendsJson?: unknown[];
  signingMessageHex?: string;
  amount?: number;
  fee?: number;
  destination?: string;
  message?: string;
};

export async function fetchVaultBalance(launcherId: string): Promise<VaultBalance> {
  const encoded = encodeURIComponent(launcherId);
  return walletFetch<VaultBalance>(`${base()}/keyvault/vault/balance/${encoded}`);
}

export async function fetchVaultDepositInfo(launcherId: string): Promise<{
  success: boolean;
  depositAddress?: string;
  totalBalance?: number;
  message?: string;
}> {
  return walletFetch(`${base()}/keyvault/vault/deposit`, {
    method: 'POST',
    body: JSON.stringify({ launcherId }),
  });
}

export async function recoverKeyVault(launcherId: string): Promise<KeyVaultRecoverResult> {
  return walletFetch(`${base()}/keyvault/recover`, {
    method: 'POST',
    body: JSON.stringify({ launcherId }),
  });
}

export async function prepareVaultWithdraw(body: {
  launcherId: string;
  destinationAddress: string;
  amount: number;
  ownerPubkeyHex: string;
  currentCidHashes: string[];
  feeAmount?: number;
}): Promise<PreparedVaultWithdraw> {
  return walletFetch(`${base()}/keyvault/vault/prepare-withdraw`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function submitKeyVaultSpend(body: {
  coinSpendsJson: unknown[];
  signatureHex: string;
}): Promise<{ success: boolean; message?: string; status?: unknown }> {
  return walletFetch(`${base()}/keyvault/submit`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type PaychatAskPrice = {
  chiaAddress: string;
  askAmountMojos: number;
  isActive: boolean;
};

export type PreparedPaychatOffer = {
  coinSpendsJson: unknown[];
  signingMessageHex: string;
  extraSigningMessagesHex?: string[];
  senderAddress?: string;
  recipientAddress?: string;
  amountMojos?: number;
  coinIds?: string[];
};

export type StoredPaychatOffer = {
  id: string;
  status: string;
};

export async function fetchPaychatAskPrice(chiaAddress: string): Promise<PaychatAskPrice | null> {
  const encoded = encodeURIComponent(chiaAddress);
  try {
    const res = await walletFetch<{ status: string; data?: PaychatAskPrice }>(
      `${base()}/paychat/ask-price/${encoded}`
    );
    return res.data ?? null;
  } catch {
    return null;
  }
}

export async function preparePaychatOffer(body: {
  senderPubkeyHex: string;
  recipientAddress: string;
  amountMojos: number;
  memo?: string;
}): Promise<PreparedPaychatOffer> {
  const res = await walletFetch<{ status: string; data?: PreparedPaychatOffer }>(
    `${base()}/paychat/prepare-offer`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  if (!res.data?.coinSpendsJson || !res.data.signingMessageHex) {
    throw new Error('Prepare offer returned incomplete data');
  }
  return res.data;
}

export async function storePaychatOffer(body: {
  senderAddress: string;
  recipientAddress: string;
  amountMojos: number;
  memo?: string;
  coinSpendsJson: unknown[];
  signatureHex: string;
  coinIds: string[];
}): Promise<StoredPaychatOffer> {
  const res = await walletFetch<{ status: string; data?: StoredPaychatOffer }>(
    `${base()}/paychat/store-offer`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  if (!res.data?.id) throw new Error('Store offer returned no id');
  return res.data;
}

export async function acceptPaychatOffer(offerId: string): Promise<void> {
  await walletFetch(`${base()}/paychat/accept-offer/${encodeURIComponent(offerId)}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function usdToMojosEstimate(usd: number): number {
  const xchPerUsd = Number(process.env.NEXT_PUBLIC_XCH_USD_RATE) || 5;
  const mojos = Math.round((usd / xchPerUsd) * 1_000_000_000_000);
  return Math.max(mojos, 1);
}

export function usdToBtcEstimate(usd: number): string {
  const btcPerUsd = Number(process.env.NEXT_PUBLIC_BTC_USD_RATE) || 95000;
  const btc = usd / btcPerUsd;
  return btc.toFixed(8);
}

export function btcEstimateToSats(btc: string): string {
  const n = Number(btc);
  if (!Number.isFinite(n)) return '0';
  return String(Math.floor(n * 100_000_000));
}

export function mojosToUsd(mojos: number, xchUsd = Number(process.env.NEXT_PUBLIC_XCH_USD_RATE) || 5): number {
  const xch = mojos / 1_000_000_000_000;
  return xch * xchUsd;
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
