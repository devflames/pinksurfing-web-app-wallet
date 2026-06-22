'use client';

import type { DerivedWallet } from './wallet-crypto';

const DEVICE_KEY = 'pinksurfing_wallet_device_key_v1';
const SECRETS_PREFIX = 'pinksurfing_wallet_secrets_v1:';

export type StoredWalletSecrets = {
  mnemonic: string;
  chiaAddress: string;
  walletPk: string;
  signingPk: string;
  launcherId?: string;
  backedUpToDrive?: boolean;
  updatedAt: string;
};

function secretsKey(email: string): string {
  return `${SECRETS_PREFIX}${email.trim().toLowerCase()}`;
}

async function getDeviceKey(): Promise<CryptoKey> {
  if (typeof window === 'undefined') {
    throw new Error('Wallet secrets storage is client-only');
  }
  let rawB64 = localStorage.getItem(DEVICE_KEY);
  if (!rawB64) {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    rawB64 = Buffer.from(raw).toString('base64');
    localStorage.setItem(DEVICE_KEY, rawB64);
  }
  const raw = Buffer.from(rawB64, 'base64');
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function seal(value: string): Promise<string> {
  const key = await getDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value)
  );
  return JSON.stringify({
    iv: Buffer.from(iv).toString('base64'),
    data: Buffer.from(new Uint8Array(ciphertext)).toString('base64'),
  });
}

async function unseal(packed: string): Promise<string> {
  const key = await getDeviceKey();
  const { iv, data } = JSON.parse(packed) as { iv: string; data: string };
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(iv, 'base64') },
    key,
    Buffer.from(data, 'base64')
  );
  return new TextDecoder().decode(plain);
}

export async function saveWalletSecrets(
  email: string,
  derived: DerivedWallet,
  extra?: Partial<StoredWalletSecrets>
): Promise<void> {
  if (!email) return;
  const payload: StoredWalletSecrets = {
    mnemonic: derived.mnemonic,
    chiaAddress: derived.chiaAddress,
    walletPk: derived.walletPk,
    signingPk: derived.signingPk,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
  const sealed = await seal(JSON.stringify(payload));
  localStorage.setItem(secretsKey(email), sealed);
}

export async function loadWalletSecrets(
  email: string | undefined | null
): Promise<StoredWalletSecrets | null> {
  if (!email || typeof window === 'undefined') return null;
  const raw = localStorage.getItem(secretsKey(email));
  if (!raw) return null;
  try {
    const json = await unseal(raw);
    const parsed = JSON.parse(json) as StoredWalletSecrets;
    if (!parsed?.chiaAddress || !parsed?.walletPk) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function updateWalletSecrets(
  email: string,
  patch: Partial<StoredWalletSecrets>
): Promise<void> {
  const current = await loadWalletSecrets(email);
  if (!current) return;
  const next: StoredWalletSecrets = { ...current, ...patch, updatedAt: new Date().toISOString() };
  const sealed = await seal(JSON.stringify(next));
  localStorage.setItem(secretsKey(email), sealed);
}

export function clearWalletSecrets(email: string): void {
  if (!email || typeof window === 'undefined') return;
  localStorage.removeItem(secretsKey(email));
}
