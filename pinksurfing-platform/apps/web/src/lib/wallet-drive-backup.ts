'use client';

import { getWalletBase } from './api-client';

const DRIVE_FILE = 'pinksurfing-wallet-backup.enc';

type WalletOAuthStart = {
  status: string;
  data?: { url: string; sessionId: string };
};

type WalletOAuthToken = {
  status: string;
  data?: {
    accessToken: string;
    refreshToken?: string | null;
    email?: string | null;
  };
  message?: string;
};

function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function startWalletDriveOAuth(): Promise<{ url: string; sessionId: string }> {
  const res = await fetch(`${getWalletBase()}/auth/google?json=true`);
  const body = (await res.json().catch(() => ({}))) as WalletOAuthStart;
  if (!res.ok || !body.data?.url || !body.data.sessionId) {
    throw new Error(
      (body as { message?: string }).message ||
        'Google Drive backup is not configured on the wallet server'
    );
  }
  return body.data;
}

export async function pollWalletDriveToken(
  sessionId: string,
  maxAttempts = 60,
  intervalMs = 2000
): Promise<{ accessToken: string; email?: string | null }> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${getWalletBase()}/auth/google/token/${encodeURIComponent(sessionId)}`);
    if (res.status === 404) {
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }
    const body = (await res.json().catch(() => ({}))) as WalletOAuthToken;
    if (!res.ok || !body.data?.accessToken) {
      throw new Error(body.message || 'Could not complete Google Drive authorization');
    }
    return { accessToken: body.data.accessToken, email: body.data.email };
  }
  throw new Error('Google Drive authorization timed out — complete sign-in in the popup');
}

/** Open Google OAuth popup and poll wallet server for Drive token. */
export async function authorizeGoogleDriveForWallet(): Promise<{
  accessToken: string;
  email?: string | null;
}> {
  const { url, sessionId } = await startWalletDriveOAuth();
  const popup = window.open(url, 'pinksurfing-drive', 'width=520,height=720');
  if (!popup) {
    throw new Error(
      'Allow pop-ups for app.pinksurfing.com to use Google Drive backup, then try again.'
    );
  }
  return pollWalletDriveToken(sessionId);
}

async function listDriveBackupFile(accessToken: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${DRIVE_FILE}' and trashed=false`);
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)&q=${q}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const list = (await listRes.json().catch(() => ({}))) as {
    files?: { id: string }[];
    error?: { message?: string };
  };
  if (!listRes.ok) {
    throw new Error(list.error?.message || 'Could not list Google Drive app folder');
  }
  return list.files?.[0]?.id ?? null;
}

export async function uploadEncryptedBackupToDrive(
  accessToken: string,
  encryptedBackupBase64: string
): Promise<void> {
  const bytes = base64ToBytes(encryptedBackupBase64);
  const metadata = {
    name: DRIVE_FILE,
    mimeType: 'application/octet-stream',
  };

  const existingId = await listDriveBackupFile(accessToken);
  const form = new FormData();
  const fileBytes = Uint8Array.from(bytes);
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([fileBytes], { type: 'application/octet-stream' }));

  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&fields=id`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id&spaces=appDataFolder';

  const uploadRes = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });

  if (!uploadRes.ok) {
    const err = (await uploadRes.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message || 'Failed to upload backup to Google Drive');
  }
}

export async function downloadEncryptedBackupFromDrive(
  accessToken: string
): Promise<string | null> {
  const fileId = await listDriveBackupFile(accessToken);
  if (!fileId) return null;

  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileRes.ok) {
    const err = (await fileRes.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message || 'Could not download backup from Google Drive');
  }
  return fileRes.text();
}
