'use client';

import { useState } from 'react';
import { BUSINESS_QR_CODES } from '@/lib/demo-data';

type Props = {
  open: boolean;
  onClose: () => void;
  onJoin: (contactId: string) => void;
};

export function BusinessQrModal({ open, onClose, onJoin }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const tryJoin = () => {
    const key = code.trim().toUpperCase();
    const entry = BUSINESS_QR_CODES[key];
    if (!entry) {
      setError('Invalid code. Try PAINT-2024, SOLAR-24, or DECK-BUILD.');
      return;
    }
    setError(null);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ps-business-qr-verified', '1');
    }
    onJoin(entry.contactId);
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-[#0B001080] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-4">
        <h2 className="mb-1 text-sm font-medium text-[var(--ps-white)]">Enter business chat</h2>
        <p className="mb-3 text-[10px] leading-relaxed text-[var(--ps-muted)]">
          Scan the contractor&apos;s QR code or enter the invite code from their business card.
        </p>

        <div className="mb-3 flex aspect-square max-h-[140px] w-full items-center justify-center rounded-lg border border-dashed border-[var(--ps-brd2)] bg-[var(--ps-surf)]">
          <div className="text-center text-[10px] text-[var(--ps-dim)]">
            <div className="mb-1 text-3xl">▦</div>
            QR scanner (demo)
          </div>
        </div>

        <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Invite code</label>
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          placeholder="PAINT-2024"
          className="mb-2 w-full rounded-md border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-3 py-2 text-[11px] text-[var(--ps-white)] outline-none"
          onKeyDown={(e) => e.key === 'Enter' && tryJoin()}
        />
        {error && <p className="mb-2 text-[10px] text-[var(--ps-red)]">{error}</p>}

        <button
          type="button"
          onClick={tryJoin}
          className="w-full rounded-lg bg-[var(--ps-pink)] py-2 text-xs font-semibold text-[var(--ps-card)]"
        >
          Join business chat
        </button>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem('ps-business-qr-verified', '1');
            onClose();
          }}
          className="mt-1.5 w-full text-[10px] text-[var(--ps-dim)] underline"
        >
          Skip for demo
        </button>

        <p className="mt-3 text-[9px] text-[var(--ps-dim)]">
          Demo codes: PAINT-2024 · SOLAR-24 · DECK-BUILD
        </p>
      </div>
    </div>
  );
}
