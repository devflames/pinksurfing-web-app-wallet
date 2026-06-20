'use client';

import { useEffect, useRef, useState } from 'react';
import type { CallMode } from '@/lib/types/call';
import {
  formatCallDuration,
  formatCallWhen,
  type CallHistoryEntry,
} from '@/lib/call-history-storage';

type Props = {
  mode: CallMode;
  contactId: string;
  contactName: string;
  history: CallHistoryEntry[];
  disabled?: boolean;
  onStart: () => void;
  videoRateLabel?: string;
};

export function CallHeaderAction({
  mode,
  contactId,
  contactName,
  history,
  disabled,
  onStart,
  videoRateLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = history.filter((h) => h.mode === mode && h.contactId === contactId).slice(0, 5);
  const isVideo = mode === 'video';
  const icon = isVideo ? '📹' : '📞';
  const label = isVideo ? 'Video' : 'Call';

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--ps-brd)] bg-[var(--ps-card)] text-[11px] text-[var(--ps-muted)] hover:text-[var(--ps-cyan)] disabled:opacity-40"
        title={isVideo ? 'Video call & history' : 'Voice call & history'}
        aria-expanded={open}
      >
        {icon}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-52 overflow-hidden rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] shadow-xl">
          <div className="border-b border-[var(--ps-brd)] px-3 py-2">
            <div className="text-[10px] font-medium text-[var(--ps-white)]">
              {label} · {contactName}
            </div>
            {videoRateLabel && (
              <div className="text-[8px] text-[var(--ps-cyan)]">{videoRateLabel}</div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onStart();
            }}
            className="w-full border-b border-[var(--ps-brd)] px-3 py-2.5 text-left text-[10px] font-medium text-[var(--ps-cyan)] hover:bg-[var(--ps-surf)]"
          >
            Start {isVideo ? 'video' : 'voice'} call
          </button>

          <div className="max-h-36 overflow-y-auto px-2 py-1.5">
            <div className="px-1 pb-1 text-[8px] uppercase tracking-wide text-[var(--ps-dim)]">
              Recent {label.toLowerCase()}s
            </div>
            {filtered.length === 0 ? (
              <p className="px-1 py-2 text-[9px] text-[var(--ps-dim)]">No {label.toLowerCase()} history yet</p>
            ) : (
              filtered.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-[9px]"
                >
                  <span className="text-[var(--ps-muted)]">
                    {h.status === 'missed' ? 'Missed' : formatCallDuration(h.durationSec)}
                    {h.costUsd != null && h.costUsd > 0 ? ` · $${h.costUsd.toFixed(2)}` : ''}
                  </span>
                  <span className="shrink-0 text-[var(--ps-dim)]">{formatCallWhen(h.startedAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
