'use client';

import type { PaychatDirection } from '@pinksurfing/ui';
import { PayChatDialIcon } from './PayChatDialIcon';

type Props = {
  active: PaychatDirection;
  incomingCount: number;
  outgoingCount: number;
  onChange: (dir: PaychatDirection) => void;
  dialStep: number;
  dialAccepting: boolean;
  onOpenDial: () => void;
};

export function PayChatDirectionTabs({
  active,
  incomingCount,
  outgoingCount,
  onChange,
  dialStep,
  dialAccepting,
  onOpenDial,
}: Props) {
  return (
    <div className="w-full min-w-0 px-2 pb-1 pt-1">
      <div className="ps-paychat-tab-thirds grid w-full grid-cols-3 overflow-hidden rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)]">
        <button
          type="button"
          onClick={() => onChange('incoming')}
          className={`ps-paychat-tab-cell border-b-2 ${
            active === 'incoming'
              ? 'border-[var(--ps-cyan)] text-[var(--ps-cyan)]'
              : 'border-transparent text-[var(--ps-dim)] hover:text-[var(--ps-muted)]'
          }`}
        >
          <span className="block text-[10px] font-medium leading-tight">Pay you</span>
          <span className="text-[8px] opacity-70">({incomingCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onChange('outgoing')}
          className={`ps-paychat-tab-cell border-b-2 ${
            active === 'outgoing'
              ? 'border-[var(--ps-pink)] text-[var(--ps-pink)]'
              : 'border-transparent text-[var(--ps-dim)] hover:text-[var(--ps-muted)]'
          }`}
        >
          <span className="block text-[10px] font-medium leading-tight">You pay</span>
          <span className="text-[8px] opacity-70">({outgoingCount})</span>
        </button>

        <div className="ps-paychat-tab-cell ps-paychat-tab-cell-dial min-w-0 border-b-2 border-transparent p-0">
          <PayChatDialIcon step={dialStep} accepting={dialAccepting} onClick={onOpenDial} />
        </div>
      </div>
    </div>
  );
}
