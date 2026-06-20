'use client';

import type { ExpiryStatus } from '@/lib/wallet-card-expiry';
import { expiryLabel } from '@/lib/wallet-card-expiry';

const STYLES: Record<ExpiryStatus, string> = {
  none: '',
  ok: 'border-[var(--ps-brd)] text-[var(--ps-dim)]',
  warning: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
  expired: 'border-[var(--ps-red)]/50 bg-[var(--ps-red)]/10 text-[var(--ps-red)]',
};

export function ExpiryBadge({
  status,
  expirationDate,
  compact,
}: {
  status: ExpiryStatus;
  expirationDate: string;
  compact?: boolean;
}) {
  const label = expiryLabel(status, expirationDate);
  if (!label || status === 'ok') {
    if (!expirationDate || compact) return null;
    return (
      <span className="text-[9px] text-[var(--ps-dim)]">
        Exp {new Date(expirationDate).toLocaleDateString()}
      </span>
    );
  }

  return (
    <div
      className={`rounded-lg border px-2 py-1 text-[9px] leading-snug ${STYLES[status]}`}
      role="status"
    >
      {status === 'warning' && '⚠ '}
      {status === 'expired' && '⛔ '}
      {label}
    </div>
  );
}
