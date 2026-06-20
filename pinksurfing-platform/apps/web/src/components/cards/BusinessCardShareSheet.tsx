'use client';

import { useRef, useState } from 'react';
import type { BusinessCardSnapshot } from '@/lib/business-card-types';
import type { SessionUser } from '@/lib/types/user';
import {
  captureBusinessCardImages,
  shareBusinessCardImages,
} from '@/lib/business-card-share-images';
import { BusinessCardSharePreview } from './BusinessCardSharePreview';

type Props = {
  open: boolean;
  card: BusinessCardSnapshot;
  user?: SessionUser | null;
  onClose: () => void;
  onShareToChat?: (card: BusinessCardSnapshot) => void;
  onShared?: (message: string) => void;
};

export function BusinessCardShareSheet({
  open,
  card,
  user = null,
  onClose,
  onShareToChat,
  onShared,
}: Props) {
  const captureFrontRef = useRef<HTMLDivElement>(null);
  const captureBackRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  if (!open) return null;

  const share = async (channel: Parameters<typeof shareBusinessCardImages>[0] | 'pinksurfing') => {
    if (channel === 'pinksurfing') {
      if (onShareToChat) {
        onShareToChat(card);
        onClose();
      }
      return;
    }

    const frontEl = captureFrontRef.current;
    const backEl = captureBackRef.current;
    if (!frontEl || !backEl) return;

    setSharing(true);
    try {
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      const images = await captureBusinessCardImages(frontEl, backEl);
      const result = await shareBusinessCardImages(channel, card, images);
      if (result === 'downloaded') {
        onShared?.('Card images saved — attach them in your chat app.');
      } else if (result === 'ok') {
        onShared?.('Business card shared.');
      }
      if (result !== 'cancelled') onClose();
    } catch {
      onShared?.('Could not create card image — try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-4 backdrop-blur-sm sm:items-center"
      onClick={sharing ? undefined : onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Share business card"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[var(--ps-white)]">Share business card</span>
          <button
            type="button"
            onClick={onClose}
            disabled={sharing}
            className="text-[var(--ps-dim)] hover:text-white disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        <p className="mb-3 text-[9px] leading-relaxed text-[var(--ps-dim)]">
          Sends PNG images of the front and back — scan the QR or tap store links to join.
        </p>

        <div className="mb-4 max-h-[40vh] overflow-y-auto rounded-xl border border-[var(--ps-brd)] bg-black/40 p-2">
          <BusinessCardSharePreview card={card} user={user} compact />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={sharing}
            onClick={() => share('whatsapp')}
            className="rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)] py-2.5 text-[10px] text-[var(--ps-white)] hover:border-[#25D366]/50 disabled:opacity-50"
          >
            {sharing ? 'Preparing…' : 'WhatsApp'}
          </button>
          <button
            type="button"
            disabled={sharing}
            onClick={() => share('telegram')}
            className="rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)] py-2.5 text-[10px] text-[var(--ps-white)] hover:border-[#229ED9]/50 disabled:opacity-50"
          >
            Telegram
          </button>
          <button
            type="button"
            disabled={sharing}
            onClick={() => share('sms')}
            className="rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-surf)] py-2.5 text-[10px] text-[var(--ps-white)] disabled:opacity-50"
          >
            Text message
          </button>
          {onShareToChat && (
            <button
              type="button"
              disabled={sharing}
              onClick={() => share('pinksurfing')}
              className="rounded-xl border border-[var(--ps-pink)]/40 bg-[var(--ps-pink)]/10 py-2.5 text-[10px] text-[var(--ps-pink)] disabled:opacity-50"
            >
              PinkSurfing chat
            </button>
          )}
          <button
            type="button"
            disabled={sharing}
            onClick={() => share('native')}
            className="col-span-2 rounded-xl border border-[var(--ps-cyan)]/40 bg-[var(--ps-cyan)]/10 py-2.5 text-[10px] text-[var(--ps-cyan)] disabled:opacity-50"
          >
            More share options…
          </button>
        </div>
      </div>

      {/* Full-size off-screen render for high-quality PNG capture */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-[-10000px] top-0 z-[-1] w-[360px]"
      >
        <BusinessCardSharePreview
          card={card}
          user={user}
          compact={false}
          frontRef={captureFrontRef}
          backRef={captureBackRef}
        />
      </div>
    </div>
  );
}
