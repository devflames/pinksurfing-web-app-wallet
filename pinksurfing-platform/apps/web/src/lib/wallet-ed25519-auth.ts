'use client';

import { sha256 } from '@noble/hashes/sha2';
import { ed } from './noble-ed25519';

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export type ProfileRegisterPayload = {
  chiaAddress: string;
  walletPk: string;
  displayName?: string;
  username?: string;
  profileData: {
    signingPk: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
};

export async function buildProfileRegisterAuth(
  signingSk: Uint8Array,
  body: ProfileRegisterPayload
): Promise<Record<string, string>> {
  const timestamp = String(Date.now());
  const { chiaAddress, profileData } = body;
  const signingPk = profileData.signingPk;
  const payload = `${chiaAddress}:${signingPk}:${timestamp}`;
  const message = sha256(new TextEncoder().encode(payload));
  const signature = await ed.sign(message, signingSk);

  return {
    'X-Auth-Timestamp': timestamp,
    'X-Auth-Signature': toBase64(signature),
  };
}

export async function buildWalletAuthHeaders(
  signingSk: Uint8Array,
  method: string,
  path: string
): Promise<Record<string, string>> {
  const timestamp = String(Date.now());
  const message = new TextEncoder().encode(`${timestamp}::${method.toUpperCase()}:${path}`);
  const signature = await ed.sign(sha256(message), signingSk);
  return {
    'X-Auth-Timestamp': timestamp,
    'X-Auth-Signature': toBase64(signature),
  };
}
