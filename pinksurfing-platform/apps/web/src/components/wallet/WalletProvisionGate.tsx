'use client';

import { WalletSetupScreen } from '@/components/wallet/WalletSetupScreen';
import { useWalletProvision } from '@/hooks/use-wallet-provision';

type Props = {
  children: React.ReactNode;
};

export function WalletProvisionGate({ children }: Props) {
  const { loading, error, provisioned, refresh } = useWalletProvision();

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
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-4 rounded-lg bg-[var(--ps-primary)] px-4 py-2 text-sm text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!provisioned) {
    return <WalletSetupScreen onLinked={refresh} />;
  }

  return <>{children}</>;
}
