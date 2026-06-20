'use client';

import { useState } from 'react';
import type { CardTypeDef, WalletCardRecord } from '@/lib/wallet-card-types';
import { cardContextPrompts, notesToSelfText } from '@/lib/wallet-card-actions';
import { expiryStatus, formatExpiryDate } from '@/lib/wallet-card-expiry';
import {
  displayCardSubtitle,
  displayNickname,
  frontPhoto,
  recordExpirationUniversal,
} from '@/lib/wallet-card-universal';
import { QrDisplay } from '@/components/profile/QrDisplay';
import { NotesToSelfBanner, WalletCardActionList } from './WalletCardActionBanner';
import { ExpiryBadge } from './ExpiryBadge';
import { extractCardContacts } from '@/lib/wallet-card-contact';
import { WalletCardContactActions } from './WalletCardContactActions';

type Props = {
  card: WalletCardRecord;
  typeDef?: CardTypeDef;
  onEdit: () => void;
  onBack: () => void;
};

export function WalletCardDetail({ card, typeDef, onEdit, onBack }: Props) {
  const [photoSide, setPhotoSide] = useState<'front' | 'back'>('front');
  const [revealed, setRevealed] = useState(!card.universal?.isPrivate);

  const nickname = displayNickname(card, typeDef);
  const subtitle = displayCardSubtitle(card, typeDef);
  const note = notesToSelfText(card);
  const context = cardContextPrompts(card, typeDef);
  const exp = recordExpirationUniversal(card);
  const status = expiryStatus(exp);
  const u = card.universal;
  const front = frontPhoto(card);
  const back = u?.backPhoto || card.fields.photoBack || '';
  const scanData = u?.barcodeData || u?.memberNumber || '';
  const showPhoto = photoSide === 'front' ? front : back;
  const contacts = extractCardContacts(card, typeDef);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="text-[10px] text-[var(--ps-cyan)] hover:underline"
      >
        ← Back to wallet
      </button>

      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ps-white)]">{typeDef?.label ?? nickname}</h3>
          {subtitle ? (
            <p className="text-[10px] text-[var(--ps-muted)]">{subtitle}</p>
          ) : (
            <p className="text-[9px] text-[var(--ps-dim)]">
              {u?.category ? u.category.replace('_', ' ') : 'Card details'}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          {u?.isPrivate && <span className="rounded-full border border-[var(--ps-brd)] px-2 py-0.5 text-[8px] text-[var(--ps-dim)]">🔒</span>}
          {u?.sharedWithFamily && <span className="rounded-full border border-violet-500/30 px-2 py-0.5 text-[8px] text-violet-300">👨‍👩‍👧</span>}
        </div>
      </div>

      {contacts.length > 0 && (
        <WalletCardContactActions links={contacts} variant="full" />
      )}

      {note && <NotesToSelfBanner text={note} large />}

      {showPhoto ? (
        <div className="overflow-hidden rounded-xl border border-[var(--ps-brd)] bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={showPhoto} alt="" className="max-h-56 w-full object-contain" />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[var(--ps-brd)] bg-[var(--ps-surf)] text-[10px] text-[var(--ps-dim)]">
          No {photoSide} photo — add one to scan at the store
        </div>
      )}

      {(front || back) && (
        <div className="flex gap-2">
          {front && (
            <button
              type="button"
              onClick={() => setPhotoSide('front')}
              className={`flex-1 rounded-lg py-1.5 text-[10px] ${
                photoSide === 'front'
                  ? 'bg-[var(--ps-pink)] text-black'
                  : 'border border-[var(--ps-brd)] text-[var(--ps-muted)]'
              }`}
            >
              Front
            </button>
          )}
          {back && (
            <button
              type="button"
              onClick={() => setPhotoSide('back')}
              className={`flex-1 rounded-lg py-1.5 text-[10px] ${
                photoSide === 'back'
                  ? 'bg-[var(--ps-pink)] text-black'
                  : 'border border-[var(--ps-brd)] text-[var(--ps-muted)]'
              }`}
            >
              Back
            </button>
          )}
        </div>
      )}

      {scanData && revealed && (
        <div className="rounded-xl border border-[var(--ps-brd)] bg-white p-4 text-center">
          <div className="mb-2 text-[9px] font-medium uppercase tracking-wide text-gray-500">
            Scan at register
          </div>
          <div className="flex justify-center">
            <QrDisplay value={scanData} size={120} fgColor="#111" />
          </div>
          <div className="mt-2 font-mono text-[10px] text-gray-700">{scanData}</div>
        </div>
      )}

      {u?.isPrivate && !revealed && (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full rounded-xl border border-[var(--ps-brd)] py-2.5 text-[11px] text-[var(--ps-cyan)]"
        >
          Tap to reveal private details
        </button>
      )}

      {revealed && u?.memberNumber && (
        <div className="rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)] px-3 py-2">
          <div className="text-[8px] uppercase tracking-wide text-[var(--ps-dim)]">Member / card #</div>
          <div className="font-mono text-[12px] text-[var(--ps-white)]">{u.memberNumber}</div>
        </div>
      )}

      {exp && u?.renewalReminder !== false && (
        <ExpiryBadge status={status} expirationDate={exp} />
      )}
      {exp && !u?.renewalReminder && (
        <span className="text-[9px] text-[var(--ps-dim)]">Expires {formatExpiryDate(exp)} (reminder off)</span>
      )}

      {context.length > 0 && <WalletCardActionList actions={context} />}

      <button
        type="button"
        onClick={onEdit}
        className="w-full rounded-xl border border-[var(--ps-brd)] py-2.5 text-[11px] text-[var(--ps-white)] hover:border-[var(--ps-cyan)]/40"
      >
        Edit card
      </button>
    </div>
  );
}
