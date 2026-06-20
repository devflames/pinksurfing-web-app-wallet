'use client';

import { useState } from 'react';
import { PayChatCardDisplay } from '@/components/cards/PayChatCardDisplay';
import { buildQrPayload } from '@/lib/qr-invite';
import { copyText, shareText } from '@/lib/wallet-identity-storage';
import { formatPaychatPrice, paychatPriceForStep } from '@/lib/paychat-pricing';
// somethng here
type Props = {
  name: string;
  inviteCode: string;
  dialStep: number;
  accepting: boolean;
  compact?: boolean;
  /** Sidebar: show header only until tapped */
  collapsible?: boolean;
};

export function PayChatReceiveCard({
  name,
  inviteCode,
  dialStep,
  accepting,
  compact = false,
  collapsible = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const qrLink = buildQrPayload('paychat', inviteCode);
  const rate = formatPaychatPrice(paychatPriceForStep(dialStep));

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 2000);
  };

  const copyCode = async () => {
    const ok = await copyText(inviteCode);
    flash(ok ? 'PayChat ID copied' : 'Copy failed');
  };

  const copyQr = async () => {
    const ok = await copyText(qrLink);
    flash(ok ? 'PayChat QR link copied' : 'Copy failed');
  };

  const shareQr = async () => {
    const result = await shareText('PayChat QR', `${name} · ${inviteCode}\n${qrLink}`);
    if (result === 'shared') flash('PayChat QR shared');
    else if (result === 'copied') flash('PayChat link copied');
    else flash('Share cancelled');
  };

  return (
    <div
      className={`rounded-xl border border-[var(--ps-pink)]/35 bg-[var(--ps-card)] ${
        compact && collapsible && !open ? 'p-2' : compact ? 'p-2.5' : 'p-3'
      }`}
    >
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span
            className={`font-semibold text-[var(--ps-white)] ${compact ? 'text-[10px]' : 'text-[11px]'}`}
          >
            Your PayChat QR
          </span>
          <span
            className={`shrink-0 text-[10px] text-[var(--ps-dim)] transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▾
          </span>
        </button>
      ) : (
        <div className="mb-2">
          <div className={`font-semibold text-[var(--ps-white)] ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
            Your PayChat QR
          </div>
          <p className={`mt-0.5 leading-snug text-[var(--ps-dim)] ${compact ? 'text-[8px]' : 'text-[9px]'}`}>
            Others scan or enter your PayChat ID to add you to their{' '}
            <span className="text-[var(--ps-pink)]">You pay</span> list — they pay you{' '}
            {accepting ? (
              <span className="text-[var(--ps-cyan)]">{rate}/msg</span>
            ) : (
              <span>when you turn incoming ON</span>
            )}{' '}
            for your attention.
          </p>
        </div>
      )}

      {(!collapsible || open) && (
        <>
          {collapsible && (
            <p
              className={`mt-1.5 leading-snug text-[var(--ps-dim)] ${compact ? 'text-[8px]' : 'text-[9px]'}`}
            >
              Others scan or enter your PayChat ID to add you to their{' '}
              <span className="text-[var(--ps-pink)]">You pay</span> list — they pay you{' '}
              {accepting ? (
                <span className="text-[var(--ps-cyan)]">{rate}/msg</span>
              ) : (
                <span>when you turn incoming ON</span>
              )}{' '}
              for your attention.
            </p>
          )}

          <div className={collapsible ? 'mt-2' : undefined}>
            <PayChatCardDisplay
              name={name}
              inviteCode={inviteCode}
              askUsd={accepting ? paychatPriceForStep(dialStep) : undefined}
              compact={compact}
              qrPurpose="receive"
            />
          </div>

          {msg && <p className="mt-2 text-[9px] text-[var(--ps-cyan)]">{msg}</p>}

          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={copyCode}
              className="rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2.5 py-1 text-[9px] text-[var(--ps-cyan)]"
            >
              Copy ID
            </button>
            <button
              type="button"
              onClick={copyQr}
              className="rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2.5 py-1 text-[9px] text-[var(--ps-cyan)]"
            >
              Copy QR link
            </button>
            <button
              type="button"
              onClick={shareQr}
              className="rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2.5 py-1 text-[9px] text-[var(--ps-cyan)]"
            >
              Share
            </button>
          </div>

          <p className="mt-2 font-mono text-[9px] text-[var(--ps-muted)]">{inviteCode}</p>
        </>
      )}
    </div>
  );
}
