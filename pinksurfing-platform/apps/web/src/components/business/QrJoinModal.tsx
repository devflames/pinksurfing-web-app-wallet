'use client';

import { useState } from 'react';
import { BusinessCardDisplay } from '@/components/cards/BusinessCardDisplay';
import { PayChatCardDisplay } from '@/components/cards/PayChatCardDisplay';
import { BUSINESS_QR_CODES, PAYCHAT_QR_CODES } from '@/lib/demo-data';
import {
  joinContactViaQr,
  parseQrInput,
  resolveQrJoin,
  type QrJoinKind,
} from '@/lib/qr-invite';

type Props = {
  kind: QrJoinKind;
  open: boolean;
  onClose: () => void;
  onJoin: (contactId: string) => void;
};

const SAMPLE_BUSINESS = {
  name: 'Paint Exterior Co.',
  credentials: 'MD',
  address: '800 W. El Camino Real, Suite 180, Mountain View, CA 94040',
  phone: '7145194674',
  email: 'billing@paintexterior.example',
  inviteCode: 'PAINT-2024',
  store: { type: 'none' as const },
};

const SAMPLE_PAYCHAT = {
  name: 'Sarah Kim',
  inviteCode: 'PS-KIM-85',
  askUsd: 8.5,
};

export function QrJoinModal({ kind, open, onClose, onJoin }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const tryJoin = (raw: string) => {
    const parsed = parseQrInput(raw);
    if (!parsed || parsed.kind !== kind) {
      setError(
        kind === 'business'
          ? 'Invalid code. Try PAINT-2024, SOLAR-24, or DECK-BUILD.'
          : 'Invalid code. Try PS-KIM-85 or PS-CHEN-7.'
      );
      return;
    }
    const entry = resolveQrJoin(kind, parsed.code);
    if (!entry) {
      setError('Invite not found.');
      return;
    }
    setError(null);
    joinContactViaQr(kind, entry.contactId);
    onJoin(entry.contactId);
    onClose();
  };

  const demoCodes =
    kind === 'business'
      ? Object.keys(BUSINESS_QR_CODES).join(' · ')
      : Object.keys(PAYCHAT_QR_CODES).join(' · ');

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl border border-[var(--ps-pink)]/40 bg-[var(--ps-card)] p-4">
        <h2 className="mb-1 text-sm font-semibold text-[var(--ps-white)]">
          {kind === 'business' ? 'Add business contact' : 'Add to You pay'}
        </h2>
        <p className="mb-3 text-[10px] leading-relaxed text-[var(--ps-muted)]">
          {kind === 'business'
            ? 'Scan a business card QR or enter their invite code to add them to Business contacts.'
            : 'Scan their PayChat QR or enter their PayChat ID — they go in your You pay list and you pay them for their attention.'}
        </p>

        <div className="mb-3">
          {kind === 'business' ? (
            <BusinessCardDisplay {...SAMPLE_BUSINESS} compact />
          ) : (
            <PayChatCardDisplay {...SAMPLE_PAYCHAT} compact />
          )}
        </div>

        <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">Invite code or QR link</label>
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          placeholder={kind === 'business' ? 'PAINT-2024' : 'PS-KIM-85'}
          className="mb-2 w-full rounded-md border border-[var(--ps-brd)] bg-black px-3 py-2 text-[11px] text-[var(--ps-white)] outline-none focus:border-[var(--ps-pink)]"
          onKeyDown={(e) => e.key === 'Enter' && tryJoin(code)}
        />
        {error && <p className="mb-2 text-[10px] text-[var(--ps-red)]">{error}</p>}

        <button
          type="button"
          onClick={() => tryJoin(code)}
          className="w-full rounded-lg bg-[var(--ps-pink)] py-2.5 text-xs font-semibold text-black"
        >
          {kind === 'business' ? 'Join business contacts' : 'Add to You pay'}
        </button>

        <p className="mt-3 text-center text-[9px] text-[var(--ps-dim)]">Demo codes: {demoCodes}</p>
      </div>
    </div>
  );
}
