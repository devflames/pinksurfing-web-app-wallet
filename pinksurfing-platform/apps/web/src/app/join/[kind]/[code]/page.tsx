'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { withBasePath } from '@/lib/base-path';
import { isChatLive } from '@/lib/chat-api';
import { executeQrJoin, QrJoinError } from '@/lib/qr-join-service';
import {
  stashPendingQrJoin,
  stashQrJoinResult,
  type QrJoinKind,
} from '@/lib/qr-invite';

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const { token, loading } = useAuth();
  const [message, setMessage] = useState('Opening invite…');

  const kind = String(params.kind ?? '') as QrJoinKind;
  const code = decodeURIComponent(String(params.code ?? ''));

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

    if (!token) {
      stashPendingQrJoin(kind, code);
      router.replace(withBasePath('/'));
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setMessage('Adding contact…');
        const result = await executeQrJoin({
          kind,
          raw: code,
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
  }, [kind, code, token, loading, router]);

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
