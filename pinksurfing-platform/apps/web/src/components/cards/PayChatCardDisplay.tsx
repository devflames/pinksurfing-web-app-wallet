'use client';

import { QrDisplay } from '@/components/profile/QrDisplay';
import { buildQrPayload } from '@/lib/qr-invite';

type Props = {
  name: string;
  inviteCode: string;
  askUsd?: number;
  compact?: boolean;
  /** receive = your card (get paid); pay = scan to add to You pay */
  qrPurpose?: 'receive' | 'pay';
};

/** PayChat card — QR adds scanner to You pay (they pay this person) */
export function PayChatCardDisplay({
  name,
  inviteCode,
  askUsd,
  compact = false,
  qrPurpose = 'pay',
}: Props) {
  const qrValue = buildQrPayload('paychat', inviteCode);

  return (
    <div
      className={`overflow-hidden rounded-xl border-2 border-[var(--ps-pink)] bg-black ${
        compact ? '' : ''
      }`}
    >
      <div className="border-b border-[var(--ps-pink)]/40 bg-[var(--ps-pink)] px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-black">
        PayChat · {qrPurpose === 'receive' ? 'Get paid' : 'Exclusive'}
      </div>
      <div className="flex items-center gap-3 p-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline gap-0.5">
            <span className="text-xl font-black text-[var(--ps-pink)]">P</span>
            <span className="text-lg font-black text-[var(--ps-green)]">$</span>
          </div>
          <div className="text-[12px] font-semibold text-[var(--ps-white)]">{name}</div>
          {askUsd != null && (
            <div className="text-[10px] text-[var(--ps-pink-soft)]">${askUsd.toFixed(2)} to unlock</div>
          )}
          <div className="font-mono text-[9px] text-[var(--ps-dim)]">{inviteCode}</div>
          <div className="text-[8px] leading-snug text-[var(--ps-dim)]">
            {qrPurpose === 'receive'
              ? 'Scan → adds you to their You pay list'
              : 'Scan → adds to your You pay list'}
          </div>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <QrDisplay value={qrValue} size={compact ? 80 : 96} fgColor="#ff1493" />
          <span className="max-w-[88px] text-center text-[7px] leading-tight text-[var(--ps-dim)]">
            {qrPurpose === 'receive' ? 'Your receive QR' : 'You pay QR'}
          </span>
        </div>
      </div>
    </div>
  );
}
