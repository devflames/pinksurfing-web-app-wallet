'use client';

import { useCallback, useEffect, useState } from 'react';
import { QrScanner } from '@/components/business/QrScanner';
import { BusinessCardDisplay } from '@/components/cards/BusinessCardDisplay';
import { PayChatCardDisplay } from '@/components/cards/PayChatCardDisplay';
import { BUSINESS_QR_CODES, PAYCHAT_QR_CODES } from '@/lib/demo-data';
import { isChatLive } from '@/lib/chat-api';
import { executeQrJoin, QrJoinError } from '@/lib/qr-join-service';
import { parseQrInput, type QrJoinKind } from '@/lib/qr-invite';

type Props = {
  kind: QrJoinKind;
  open: boolean;
  token: string | null;
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

export function QrJoinModal({ kind, open, token, onClose, onJoin }: Props) {
  const live = isChatLive();
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setCode('');
    setError(null);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  if (!open) return null;

  const tryJoin = async (raw: string) => {
    const parsed = parseQrInput(raw);
    if (!parsed || parsed.kind !== kind) {
      setError(
        kind === 'business'
          ? live
            ? 'Paste their Share-tab join link or business email.'
            : 'Invalid business code. Scan their card QR or enter their business invite code.'
          : live
            ? 'Paste their Share-tab join link or PayChat ID (PS-…).'
            : 'Invalid PayChat code. Scan their PayChat QR or enter their PS- ID.'
      );
      return;
    }

    if (live && !token) {
      setError('Sign in to add contacts.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const entry = await executeQrJoin({
        kind,
        raw,
        token,
        live,
      });
      onJoin(entry.contactId);
      onClose();
    } catch (e) {
      setError(e instanceof QrJoinError || e instanceof Error ? e.message : 'Could not add contact');
    } finally {
      setBusy(false);
    }
  };

  const demoCodes =
    kind === 'business'
      ? Object.keys(BUSINESS_QR_CODES).join(' · ')
      : Object.keys(PAYCHAT_QR_CODES).join(' · ');

  const manualPlaceholder =
    kind === 'business'
      ? live
        ? 'https://app.pinksurfing.com/join/business/… or name@company.com'
        : 'PAINT-2024'
      : live
        ? 'https://app.pinksurfing.com/join/paychat/PS-…'
        : 'PS-KIM-85';

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl border border-[var(--ps-pink)]/40 bg-[var(--ps-card)] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--ps-white)]">
            {kind === 'business' ? 'Add business contact' : 'Add to You pay'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none text-[var(--ps-muted)] hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="mb-3 text-[10px] leading-relaxed text-[var(--ps-muted)]">
          {kind === 'business'
            ? live
              ? 'Ask them to open Share and send you their business join link, or enter their business email.'
              : 'Scan a business card QR or enter their invite code to add them to Business contacts.'
            : live
              ? 'Ask them to open Share and send you their PayChat join link, or enter their PayChat ID.'
              : 'Scan their PayChat QR or enter their PayChat ID — they go in your You pay list.'}
        </p>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('scan')}
            className={`flex-1 rounded-lg py-2 text-[10px] font-semibold ${
              mode === 'scan'
                ? 'bg-[var(--ps-pink)] text-black'
                : 'border border-[var(--ps-brd)] text-[var(--ps-muted)]'
            }`}
          >
            Scan QR
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 rounded-lg py-2 text-[10px] font-semibold ${
              mode === 'manual'
                ? 'bg-[var(--ps-pink)] text-black'
                : 'border border-[var(--ps-brd)] text-[var(--ps-muted)]'
            }`}
          >
            Enter code
          </button>
        </div>

        {mode === 'scan' ? (
          <div className="mb-3">
            <QrScanner
              active={open && mode === 'scan'}
              onScan={(text) => {
                void tryJoin(text);
              }}
              onError={(message) => setError(message)}
            />
            <p className="mt-2 text-center text-[9px] text-[var(--ps-dim)]">
              {live
                ? 'Camera unavailable on desktop? Switch to Enter code and paste their Share link.'
                : `Point your camera at their ${kind === 'business' ? 'business' : 'PayChat'} card QR`}
            </p>
          </div>
        ) : (
          <>
            {!live && (
              <div className="mb-3">
                {kind === 'business' ? (
                  <BusinessCardDisplay {...SAMPLE_BUSINESS} compact />
                ) : (
                  <PayChatCardDisplay {...SAMPLE_PAYCHAT} compact />
                )}
              </div>
            )}

            <label className="mb-1 block text-[10px] text-[var(--ps-dim)]">
              {live ? 'Join link, email, or code' : 'Invite code or QR link'}
            </label>
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              placeholder={manualPlaceholder}
              className="mb-2 w-full rounded-md border border-[var(--ps-brd)] bg-black px-3 py-2 text-[11px] text-[var(--ps-white)] outline-none focus:border-[var(--ps-pink)]"
              onKeyDown={(e) => e.key === 'Enter' && void tryJoin(code)}
            />
          </>
        )}

        {error && <p className="mb-2 text-[10px] text-[var(--ps-red)]">{error}</p>}

        {mode === 'manual' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void tryJoin(code)}
            className="w-full rounded-lg bg-[var(--ps-pink)] py-2.5 text-xs font-semibold text-black disabled:opacity-60"
          >
            {busy
              ? 'Adding…'
              : kind === 'business'
                ? 'Join business contacts'
                : 'Add to You pay'}
          </button>
        )}

        {busy && mode === 'scan' && (
          <p className="mt-2 text-center text-[10px] text-[var(--ps-muted)]">Adding contact…</p>
        )}

        {!live && (
          <p className="mt-3 text-center text-[9px] text-[var(--ps-dim)]">Demo codes: {demoCodes}</p>
        )}
      </div>
    </div>
  );
}
