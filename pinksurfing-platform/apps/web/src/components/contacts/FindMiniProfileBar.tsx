'use client';

import { ContactMiniProfilePanel } from '@/components/contacts/ContactMiniProfilePanel';
import { discoverPersonToMiniProfile } from '@/lib/mini-profile';
import type { DiscoverPerson } from '@/lib/discover-people';

type Props = {
  person: DiscoverPerson;
  onVisit: () => void;
  onRequest?: () => void;
  requestSent?: boolean;
  connected?: boolean;
};

export function FindMiniProfileBar({
  person,
  onVisit,
  onRequest,
  requestSent,
  connected,
}: Props) {
  const footer =
    !connected && onRequest ? (
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--ps-brd)]/50 pt-2">
        <div className="min-w-0 text-[8px] text-[var(--ps-dim)]">
          PayChat: <span className="font-mono text-[var(--ps-cyan)]">{person.paychatId}</span>
        </div>
        <button
          type="button"
          disabled={requestSent}
          onClick={onRequest}
          className="shrink-0 rounded-lg bg-[var(--ps-pink)] px-3 py-1 text-[9px] font-semibold text-[var(--ps-card)] disabled:opacity-50"
        >
          {requestSent ? 'Request sent' : 'Request contact'}
        </button>
      </div>
    ) : undefined;

  return (
    <ContactMiniProfilePanel
      person={discoverPersonToMiniProfile(person)}
      onVisit={onVisit}
      footer={footer}
    />
  );
}
