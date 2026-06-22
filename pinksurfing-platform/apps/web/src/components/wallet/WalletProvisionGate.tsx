'use client';

import { WalletRestoreScreen, WalletSetupScreen } from '@/components/wallet/WalletSetupScreen';
import { useAuth } from '@/lib/auth-context';
import { useWalletProvision } from '@/hooks/use-wallet-provision';

type Props = {
  children: React.ReactNode;
};

export function WalletProvisionGate({ children }: Props) {
  const { logout } = useAuth();
  const { loading, error, sessionExpired, phase, refresh } = useWalletProvision();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-[var(--ps-muted)]">Checking wallet…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)] p-6 text-center">
          <p className="text-sm text-red-300">{error}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {sessionExpired ? (
              <button
                type="button"
                onClick={logout}
                className="rounded-lg bg-[var(--ps-primary)] px-4 py-2 text-sm text-white"
              >
                Sign in again
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-lg bg-[var(--ps-primary)] px-4 py-2 text-sm text-white"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'setup') {
    return <WalletSetupScreen onComplete={refresh} />;
  }

  if (phase === 'restore') {
    return <WalletRestoreScreen onComplete={refresh} />;
  }

  if (phase === 'ready') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <p className="text-sm text-[var(--ps-muted)]">Loading wallet…</p>
    </div>
  );
}
