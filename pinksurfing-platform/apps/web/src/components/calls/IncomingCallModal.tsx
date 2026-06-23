'use client';

import type { IncomingCall } from '@/lib/types/call';

type Props = {
  call: IncomingCall;
  onAccept: () => void;
  onReject: () => void;
};

export function IncomingCallModal({ call, onAccept, onReject }: Props) {
  const title = call.isGroup
    ? call.groupName || 'Group call'
    : call.callerName;
  const subtitle = call.isGroup
    ? `${call.callerName} · group ${call.mode === 'video' ? 'video' : 'voice'}`
    : call.mode === 'video'
      ? 'Incoming video call'
      : 'Incoming voice call';

  return (
    <div className="ps-modal-backdrop fixed inset-0 z-[110] flex items-end justify-center bg-black/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-5 shadow-2xl">
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--ps-cyan)]/15 text-3xl">
            {call.mode === 'video' ? '📹' : '📞'}
          </div>
          <p className="text-[10px] uppercase tracking-widest text-[var(--ps-cyan)]">{subtitle}</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--ps-white)]">{title}</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onReject}
            className="rounded-xl border border-[var(--ps-brd)] py-3 text-sm font-medium text-[var(--ps-muted)]"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-xl bg-[var(--ps-green,#5DCAA5)] py-3 text-sm font-semibold text-[var(--ps-card)]"
          >
            Answer
          </button>
        </div>
      </div>
    </div>
  );
}
