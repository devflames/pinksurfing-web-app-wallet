'use client';

import { CallsContactsIcon } from '@/components/icons/CallsContactsIcon';
import { ContactSearchIcon } from '@/components/icons/ContactSearchIcon';

type HomeOverlay = 'calls' | 'find';

type Props = {
  incomingRequestCount: number;
  onOpen: (overlay: HomeOverlay) => void;
};

export function HomeSidebarActions({ incomingRequestCount, onOpen }: Props) {
  return (
    <div className="flex items-center justify-center gap-3 border-b border-[var(--ps-brd)] px-2 py-2.5">
      <button
        type="button"
        onClick={() => onOpen('calls')}
        className="group flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-colors hover:bg-[var(--ps-card)]"
        title="Calls & contacts"
      >
        <CallsContactsIcon size={32} />
        <span className="text-[8px] text-[var(--ps-dim)] group-hover:text-[var(--ps-muted)]">
          Calls
        </span>
      </button>
      <button
        type="button"
        onClick={() => onOpen('find')}
        className="group relative flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-colors hover:bg-[var(--ps-card)]"
        title="Find people & requests"
      >
        <ContactSearchIcon size={32} />
        {incomingRequestCount > 0 && (
          <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--ps-pink)] px-1 text-[7px] font-bold text-[var(--ps-card)]">
            {incomingRequestCount}
          </span>
        )}
        <span className="text-[8px] text-[var(--ps-dim)] group-hover:text-[var(--ps-muted)]">
          Find
        </span>
      </button>
    </div>
  );
}
