'use client';

import {
  PINKSURFING_APP_STORE_URL,
  PINKSURFING_APP_URL,
  PINKSURFING_PLAY_STORE_URL,
} from '@/lib/business-card-types';
import { QrDisplay } from '@/components/profile/QrDisplay';

type Props = {
  compact?: boolean;
  className?: string;
};

function StoreLink({
  href,
  label,
  sub,
  compact,
}: {
  href: string;
  label: string;
  sub: string;
  compact?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-[#d4a017]/70 bg-gradient-to-b from-[#f5d76e] to-[#d4a017] px-2 py-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-opacity hover:opacity-90 ${
        compact ? 'min-h-[44px]' : 'min-h-[48px]'
      }`}
    >
      <span className="text-[8px] font-bold uppercase leading-tight tracking-wide text-black">
        {label}
      </span>
      <span className="mt-0.5 text-[6px] font-medium text-black/70">{sub}</span>
    </a>
  );
}

/** Back of business card — app download QR + store / web links */
export function BusinessCardBackDisplay({ compact = false, className = '' }: Props) {
  const padY = compact ? 'py-3' : 'py-4';
  const minH = compact ? 'min-h-[200px]' : 'min-h-[240px]';
  const qrSize = compact ? 52 : 60;
  const square = compact ? 68 : 76;

  return (
    <div
      className={`overflow-hidden rounded-xl border-2 border-[#ff1493] bg-black ${minH} ${className}`}
    >
      <div className={`flex ${minH} flex-col items-center justify-center px-3 ${padY}`}>
        <div
          className="mb-2 flex items-center justify-center rounded-xl border border-[#ff1493]/40 bg-white p-1.5"
          style={{ width: square, height: square }}
        >
          <QrDisplay value={PINKSURFING_APP_URL} size={qrSize} fgColor="#ff1493" />
        </div>

        <p className="mb-2 text-center text-[8px] font-medium text-[var(--ps-white)]">
          Scan or tap to join PinkSurfing
        </p>

        <div className="flex w-full max-w-[280px] gap-1.5">
          <StoreLink
            href={PINKSURFING_APP_STORE_URL}
            label="App Store"
            sub="iPhone"
            compact={compact}
          />
          <StoreLink
            href={PINKSURFING_PLAY_STORE_URL}
            label="Google Play"
            sub="Android"
            compact={compact}
          />
          <StoreLink href={PINKSURFING_APP_URL} label="Web app" sub="Browser" compact={compact} />
        </div>

        <p className="mt-2 max-w-[240px] text-center text-[7px] leading-relaxed text-[var(--ps-dim)]">
          Business contacts, PayChat, and your wallet — one marketplace.
        </p>
      </div>
    </div>
  );
}
