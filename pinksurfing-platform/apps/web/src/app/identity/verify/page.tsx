'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { withBasePath } from '@/lib/base-path';
import { fetchIdentityStatus } from '@/lib/identity-service';

/** Return landing page after Didit KYC — refreshes status and sends user back to Me */
export default function IdentityVerifyPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [message, setMessage] = useState('Confirming your verification…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (token) {
        try {
          const status = await fetchIdentityStatus(token);
          if (cancelled) return;
          if (status.verified) {
            setMessage('You’re certified — welcome to PinkSurfing Pro.');
          } else if (
            status.status === 'in_progress' ||
            status.status === 'in_review'
          ) {
            setMessage('Verification submitted — we’ll update your profile when Didit finishes.');
          } else {
            setMessage('Verification not complete yet. You can try again from Me.');
          }
        } catch {
          if (!cancelled) setMessage('Could not refresh status. Open Me to try again.');
        }
      }
      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('returnUrl');
      const dest =
        returnUrl && returnUrl.startsWith('/')
          ? returnUrl
          : withBasePath('/?section=me');
      window.setTimeout(() => router.replace(dest), 2200);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--ps-amber)]/30 border-t-[var(--ps-amber)]" />
      <p className="max-w-sm text-[13px] text-[var(--ps-white)]">{message}</p>
      <p className="mt-2 text-[10px] text-[var(--ps-dim)]">Redirecting…</p>
    </div>
  );
}
