'use client';

import type { Contact } from '@pinksurfing/ui';
import type { CallMode } from '@/lib/types/call';
import {
  formatCallDuration,
  formatCallWhen,
  type CallHistoryEntry,
} from '@/lib/call-history-storage';

type Props = {
  contacts: Contact[];
  history: CallHistoryEntry[];
  activeContactId: string;
  onClose: () => void;
  onSelectContact: (id: string) => void;
  onStartCall: (contactId: string, mode: CallMode) => void;
};

export function CallsContactsOverlay({
  contacts,
  history,
  activeContactId,
  onClose,
  onSelectContact,
  onStartCall,
}: Props) {
  const recent = history.slice(0, 12);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ps-bg)]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--ps-brd)] bg-[var(--ps-surf)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--ps-white)]">Calls &amp; contacts</div>
          <div className="text-[9px] text-[var(--ps-muted)]">
            Recent calls and people you&apos;re connected with
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[var(--ps-brd)] px-2.5 py-1 text-[10px] text-[var(--ps-muted)] hover:text-[var(--ps-white)]"
        >
          Close
        </button>
      </div>

      <div className="ps-scroll flex-1 overflow-y-auto p-4">
        <section className="mb-5">
          <div className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-[var(--ps-dim)]">
            Recent calls
          </div>
          {recent.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--ps-brd)] px-3 py-6 text-center text-[10px] text-[var(--ps-dim)]">
              No calls yet — start one from a contact below or from the chat header.
            </p>
          ) : (
            <div className="space-y-1">
              {recent.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    onSelectContact(h.contactId);
                    onClose();
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] px-3 py-2.5 text-left transition-colors hover:border-[var(--ps-cyan)]/40 ${
                    h.contactId === activeContactId ? 'ring-1 ring-[var(--ps-cyan)]/30' : ''
                  }`}
                >
                  <span className="text-base">{h.mode === 'video' ? '📹' : '📞'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-medium text-[var(--ps-white)]">
                      {h.contactName}
                    </div>
                    <div className="text-[9px] text-[var(--ps-dim)]">
                      {h.status === 'missed' ? 'Missed' : formatCallDuration(h.durationSec)}
                      {h.costUsd != null && h.costUsd > 0 ? ` · $${h.costUsd.toFixed(2)}` : ''}
                      {' · '}
                      {formatCallWhen(h.startedAt)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-[var(--ps-dim)]">
            Connected ({contacts.length})
          </div>
          <div className="space-y-1">
            {contacts.map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-2 rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] px-3 py-2 ${
                  c.id === activeContactId ? 'ring-1 ring-[var(--ps-pink)]/30' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectContact(c.id);
                    onClose();
                  }}
                  className="min-w-0 flex-1 truncate text-left text-[11px] text-[var(--ps-white)] hover:text-[var(--ps-cyan)]"
                >
                  {c.name}
                </button>
                <button
                  type="button"
                  onClick={() => onStartCall(c.id, 'voice')}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--ps-brd)] text-[10px] hover:text-[var(--ps-cyan)]"
                  title="Voice call"
                >
                  📞
                </button>
                <button
                  type="button"
                  onClick={() => onStartCall(c.id, 'video')}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--ps-brd)] text-[10px] hover:text-[var(--ps-pink)]"
                  title="Video call"
                >
                  📹
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
