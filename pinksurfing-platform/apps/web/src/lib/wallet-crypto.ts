'use client';

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { sha256 } from '@noble/hashes/sha2';
import * as ed from '@noble/ed25519';
import { withBasePath } from './base-path';

export type DerivedWallet = {
  mnemonic: string;
  chiaAddress: string;
  walletPk: string;
  ownerPubkeyHex: string;
  signingSk: Uint8Array;
  signingPk: string;
  puzzleHash: Uint8Array;
};

function signingKeyFromSeed(seed: Uint8Array): { signingSk: Uint8Array; signingPk: string } {
  const signingSk = sha256(new Uint8Array([...seed, ...new TextEncoder().encode(':pinksurfing-signing-v1')]));
  const signingPkBytes = ed.getPublicKey(signingSk);
  return {
    signingSk,
    signingPk: bytesToHex(signingPkBytes),
  };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, 'hex'))
    .join('');
}

/** Generate a fresh BIP39 mnemonic (12 words). */
export function createMnemonic(): string {
  return generateMnemonic(wordlist, 128);
}

export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic.trim(), wordlist);
}

async function deriveWalletPkFromSeed(seed: Uint8Array): Promise<string> {
  const { PrivateKey, deriveChildSk, deriveChildSkUnhardened } = await import('chia-bls');
  const masterSk = PrivateKey.fromSeed(seed);
  let sk = deriveChildSk(masterSk, 12381);
  sk = deriveChildSk(sk, 8444);
  sk = deriveChildSk(sk, 2);
  sk = deriveChildSkUnhardened(sk, 0);
  return sk.getG1().toHex();
}

async function resolveChiaAddress(walletPk: string): Promise<string> {
  const res = await fetch(withBasePath('/api/wallet/derive-address'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletPk }),
  });
  const body = (await res.json().catch(() => ({}))) as { chiaAddress?: string; message?: string };
  if (!res.ok || !body.chiaAddress) {
    throw new Error(body.message || 'Could not derive wallet address');
  }
  return body.chiaAddress;
}

/**
 * Derive PinkSurfing wallet keys from a mnemonic (client-side keys; address via server puzzle hash).
 */
export async function deriveWalletFromMnemonic(mnemonic: string): Promise<DerivedWallet> {
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error('Invalid recovery phrase');
  }

  const seed = mnemonicToSeedSync(normalized);
  const walletPk = await deriveWalletPkFromSeed(seed);
  const chiaAddress = await resolveChiaAddress(walletPk);
  const { signingSk, signingPk } = signingKeyFromSeed(seed);

  return {
    mnemonic: normalized,
    chiaAddress,
    walletPk,
    ownerPubkeyHex: walletPk,
    signingSk,
    signingPk,
    puzzleHash: new Uint8Array(32),
  };
}

export async function encryptBackupBlob(
  payload: Record<string, unknown>,
  password: string
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    'raw',
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const packed = {
    v: 1,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(ciphertext)),
  };
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(packed)));
}

export async function decryptBackupBlob(
  encryptedBase64: string,
  password: string
): Promise<Record<string, unknown>> {
  const packed = JSON.parse(new TextDecoder().decode(base64ToBytes(encryptedBase64))) as {
    iv: string;
    data: string;
  };
  const key = await crypto.subtle.importKey(
    'raw',
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const ivBytes = new Uint8Array(base64ToBytes(packed.iv));
  const dataBytes = new Uint8Array(base64ToBytes(packed.data));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    dataBytes
  );
  return JSON.parse(new TextDecoder().decode(plain)) as Record<string, unknown>;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function downloadRecoveryPhraseFile(mnemonic: string, walletAddress: string): void {
  const text = [
    'PinkSurfing Wallet Recovery',
    '============================',
    '',
    'Keep this phrase private. Anyone with it can access your wallet.',
    '',
    `Wallet address: ${walletAddress}`,
    '',
    'Recovery phrase (12 words):',
    mnemonic,
    '',
    `Generated: ${new Date().toISOString()}`,
  ].join('\n');

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pinksurfing-wallet-recovery.txt';
  a.click();
  URL.revokeObjectURL(url);
}
