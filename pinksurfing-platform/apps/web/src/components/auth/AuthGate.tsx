'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import { LoginScreen } from '@/components/auth/LoginScreen';

const AppShell = dynamic(
  () => import('@/components/shell/AppShell').then((m) => ({ default: m.AppShell })),
  {
    loading: () => (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-[var(--ps-muted)]">Loading app…</p>
      </div>
    ),
  }
);

export function AuthGate() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="ps-app-bg flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-[var(--ps-muted)]">Loading…</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="ps-app-bg flex min-h-screen items-center justify-center p-4">
        <LoginScreen />
      </div>
    );
  }

  return (
    <div className="ps-app-bg flex min-h-screen justify-center p-3 sm:p-4">
      <div className="flex w-full max-w-6xl flex-1 flex-col">
        <AppShell />
      </div>
    </div>
  );
}
