/** Per-user wallet identity stored locally (non-custodial — keys stay on device). */

export type WalletIdentity = {
  chiaAddress: string;
  btcPubkey?: string;
};

const PREFIX = 'pinksurfing_wallet_identity_v1:';

function storageKey(email: string): string {
  return `${PREFIX}${email.trim().toLowerCase()}`;
}

export function loadWalletIdentity(email: string | undefined | null): WalletIdentity | null {
  if (!email || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalletIdentity;
    if (!parsed?.chiaAddress?.trim()) return null;
    return {
      chiaAddress: parsed.chiaAddress.trim(),
      btcPubkey: parsed.btcPubkey?.trim() || undefined,
    };
  } catch {
    return null;
  }
}

export function saveWalletIdentity(email: string, identity: WalletIdentity): void {
  if (!email || typeof window === 'undefined') return;
  localStorage.setItem(
    storageKey(email),
    JSON.stringify({
      chiaAddress: identity.chiaAddress.trim(),
      btcPubkey: identity.btcPubkey?.trim() || '',
    })
  );
}

export async function copyText(value: string): Promise<boolean> {
  if (!value || typeof navigator === 'undefined') return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export async function shareText(label: string, value: string): Promise<'shared' | 'copied' | 'failed'> {
  const text = value?.trim();
  if (!text) return 'failed';
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: `PinkSurfing — ${label}`, text });
      return 'shared';
    } catch {
      return 'failed';
    }
  }
  const ok = await copyText(text);
  return ok ? 'copied' : 'failed';
}
