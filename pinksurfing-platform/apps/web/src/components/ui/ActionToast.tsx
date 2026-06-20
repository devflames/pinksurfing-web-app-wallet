'use client';

import { useShellNav } from '@/lib/shell-nav-context';

type Props = {
  message: string | null;
  onDismiss?: () => void;
};

export function ActionToast({ message, onDismiss }: Props) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[100] -translate-x-1/2 px-4">
      <div
        className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl border border-[var(--ps-cyan)]/30 bg-[var(--ps-card)] px-4 py-2.5 text-[11px] text-[var(--ps-white)] shadow-lg"
        role="status"
      >
        <span className="text-[var(--ps-green)]">✓</span>
        <span className="flex-1">{message}</span>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="text-[var(--ps-dim)]">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export function ShellChrome({ children }: { children: React.ReactNode }) {
  const { toast, clearToast } = useShellNav();
  return (
    <>
      <ActionToast message={toast} onDismiss={clearToast} />
      {children}
    </>
  );
}
