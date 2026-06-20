'use client';

import type { CardContactLink } from '@/lib/wallet-card-contact';

type Props = {
  links: CardContactLink[];
  /** Prevent parent button from opening detail when tapping a link */
  stopPropagation?: boolean;
  variant?: 'compact' | 'full' | 'list-right';
};

export function WalletCardContactActions({
  links,
  stopPropagation = false,
  variant = 'full',
}: Props) {
  if (links.length === 0) return null;

  const phones = links.filter((l) => l.kind === 'phone');
  const addresses = links.filter((l) => l.kind === 'address');

  const stop = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
  };

  if (variant === 'list-right') {
    if (phones.length === 0) return null;
    return (
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        {phones.slice(0, 2).map((l) => (
          <a
            key={l.id}
            href={l.href}
            onClick={stop}
            className="whitespace-nowrap text-[9px] font-medium text-[var(--ps-cyan)] hover:underline"
          >
            📞 {l.value}
          </a>
        ))}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex flex-col gap-1">
        {phones.map((l) => (
          <a
            key={l.id}
            href={l.href}
            onClick={stop}
            className="flex items-center gap-2 rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2.5 py-2 transition-colors hover:border-[var(--ps-cyan)]/40 hover:bg-[var(--ps-cyan)]/5"
          >
            <span className="text-[11px] font-medium text-[var(--ps-cyan)]">📞 {l.value}</span>
            <span className="text-[8px] text-[var(--ps-dim)]">Tap to call</span>
          </a>
        ))}
        {addresses.map((l) => (
          <a
            key={l.id}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stop}
            className="rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2.5 py-2 transition-colors hover:border-[var(--ps-cyan)]/40 hover:bg-[var(--ps-cyan)]/5"
          >
            <div className="text-[10px] leading-snug text-[var(--ps-cyan)]">📍 {l.value}</div>
            <div className="text-[8px] text-[var(--ps-dim)]">Open in Google Maps</div>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {phones.length > 0 && (
        <div className="rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-2">
          <div className="mb-1.5 px-1 text-[8px] font-semibold uppercase tracking-wide text-[var(--ps-dim)]">
            Tap to call
          </div>
          <div className="flex flex-col gap-1">
            {phones.map((l) => (
              <a
                key={l.id}
                href={l.href}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-3 py-2.5 transition-colors hover:border-[var(--ps-cyan)]/40 hover:bg-[var(--ps-cyan)]/5"
              >
                <span className="text-[10px] text-[var(--ps-dim)]">{l.label}</span>
                <span className="text-[12px] font-medium text-[var(--ps-cyan)]">📞 {l.value}</span>
              </a>
            ))}
          </div>
        </div>
      )}
      {addresses.length > 0 && (
        <div className="rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-2">
          <div className="mb-1.5 px-1 text-[8px] font-semibold uppercase tracking-wide text-[var(--ps-dim)]">
            Tap for directions
          </div>
          <div className="flex flex-col gap-1">
            {addresses.map((l) => (
              <a
                key={l.id}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-3 py-2.5 transition-colors hover:border-[var(--ps-cyan)]/40 hover:bg-[var(--ps-cyan)]/5"
              >
                <div className="text-[9px] text-[var(--ps-dim)]">{l.label}</div>
                <div className="text-[11px] leading-snug text-[var(--ps-cyan)]">📍 {l.value}</div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
