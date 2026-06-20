'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { withBasePath } from '@/lib/base-path';
import type { SessionUser } from '@/lib/types/user';

export default function GoogleAuthCompletePage() {
  const router = useRouter();
  const { establishSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const ssoError = params.get('sso_error');
        if (ssoError) {
          throw new Error(`Google sign-in failed (${ssoError})`);
        }

        const useSsoCookies = params.get('sso_google') === 'success';

        const bootstrapUrl = useSsoCookies
          ? withBasePath('/api/auth/sso-cookie-bootstrap')
          : withBasePath('/api/auth/oauth-bootstrap');

        const res = await fetch(bootstrapUrl, { credentials: 'include' });
        const data = (await res.json().catch(() => ({}))) as {
          token?: string;
          user?: SessionUser;
          message?: string;
        };

        if (!res.ok || !data.token || !data.user) {
          throw new Error(data.message || 'Could not complete Google sign-in');
        }

        if (cancelled) return;
        establishSession(data.token, data.user);
        router.replace(withBasePath('/'));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Google sign-in failed');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [establishSession, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--ps-bg)] p-6">
      <div className="w-full max-w-sm rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)] p-6 text-center">
        <h1 className="text-sm font-medium text-[var(--ps-white)]">PinkSurfing</h1>
        {error ? (
          <>
            <p className="mt-3 text-[11px] text-[var(--ps-red)]">{error}</p>
            <button
              type="button"
              onClick={() => router.replace(withBasePath('/'))}
              className="mt-4 text-[10px] text-[var(--ps-cyan)] underline"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <p className="mt-3 text-[11px] text-[var(--ps-muted)]">Completing Google sign-in…</p>
        )}
      </div>
    </div>
  );
}
