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
};

export async function startWalletDriveOAuth(): Promise<{ url: string; sessionId: string }> {
  const res = await fetch(`${getWalletBase()}/auth/google?json=true`);
  const body = (await res.json().catch(() => ({}))) as WalletOAuthStart;
  if (!res.ok || !body.data?.url || !body.data.sessionId) {
    throw new Error('Google Drive backup is not configured on the wallet server');
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
      throw new Error('Could not complete Google Drive authorization');
    }
    return { accessToken: body.data.accessToken, email: body.data.email };
  }
  throw new Error('Google Drive authorization timed out');
}

export async function uploadEncryptedBackupToDrive(
  accessToken: string,
  encryptedBackupBase64: string
): Promise<void> {
  const metadata = {
    name: DRIVE_FILE,
    parents: ['appDataFolder'],
  };

  const boundary = `pinksurfing-${Date.now()}`;
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/octet-stream\r\n\r\n' +
    `${encryptedBackupBase64}\r\n` +
    `--${boundary}--`;

  const listRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=' +
      encodeURIComponent(`name='${DRIVE_FILE}'`),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const list = (await listRes.json().catch(() => ({}))) as {
    files?: { id: string }[];
  };

  const existingId = list.files?.[0]?.id;
  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const uploadRes = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to upload backup to Google Drive');
  }
}

export async function downloadEncryptedBackupFromDrive(
  accessToken: string
): Promise<string | null> {
  const listRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=' +
      encodeURIComponent(`name='${DRIVE_FILE}'`),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const list = (await listRes.json().catch(() => ({}))) as {
    files?: { id: string }[];
  };
  const fileId = list.files?.[0]?.id;
  if (!fileId) return null;

  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileRes.ok) return null;
  return fileRes.text();
}
