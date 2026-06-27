'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { withBasePath } from '@/lib/base-path';
import { isChatLive } from '@/lib/chat-api';
import { executeQrJoin, QrJoinError } from '@/lib/qr-join-service';
import {
  qrJoinBaseUrl,
  stashPendingQrJoin,
  stashQrJoinResult,
  type QrJoinKind,
} from '@/lib/qr-invite';

export default function JoinPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token, loading } = useAuth();
  const [message, setMessage] = useState('Opening invite…');

  const kind = String(params.kind ?? '') as QrJoinKind;
  const code = decodeURIComponent(String(params.code ?? ''));
  const email = searchParams.get('email');

  useEffect(() => {
    if (kind !== 'business' && kind !== 'paychat') {
      setMessage('Invalid invite link.');
      return;
    }
    if (!code) {
      setMessage('Missing invite code.');
      return;
    }
    if (loading) return;

    const joinRaw = email
      ? `${qrJoinBaseUrl()}/join/${kind}/${encodeURIComponent(code)}?email=${encodeURIComponent(email)}`
      : code;

    if (!token) {
      stashPendingQrJoin(kind, joinRaw);
      router.replace(withBasePath('/'));
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setMessage('Adding contact…');
        const result = await executeQrJoin({
          kind,
          raw: joinRaw,
          token,
          live: isChatLive(),
        });
        if (cancelled) return;
        stashQrJoinResult({ kind, contactId: result.contactId });
        router.replace(withBasePath('/'));
      } catch (e) {
        if (!cancelled) {
          setMessage(
            e instanceof QrJoinError || e instanceof Error ? e.message : 'Could not complete invite'
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kind, code, email, token, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6 text-center">
      <div className="max-w-sm rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)] p-6">
        <p className="text-sm text-[var(--ps-muted)]">{message}</p>
        {message !== 'Opening invite…' && message !== 'Adding contact…' && (
          <button
            type="button"
            onClick={() => router.replace(withBasePath('/'))}
            className="mt-4 rounded-lg bg-[var(--ps-primary)] px-4 py-2 text-sm text-white"
          >
            Back to app
          </button>
        )}
      </div>
    </div>
  );
}
