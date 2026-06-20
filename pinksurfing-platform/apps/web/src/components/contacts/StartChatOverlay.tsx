'use client';

import { useMemo, useState } from 'react';
import {
  hasPendingRequest,
  sendBusinessRequest,
  type BusinessContactRequest,
} from '@/lib/business-contact-requests';
import {
  filterDirectoryByFilters,
  directoryStates,
  type DirectoryBusiness,
} from '@/lib/ps-business-directory';
import {
  defaultDiscoverFilters,
  loadFindZip,
  saveFindZip,
  type DiscoverFilters,
} from '@/lib/discover-people';
import { CollapsibleFiltersPanel } from '@/components/contacts/CollapsibleFiltersPanel';
import {
  filterPhoneBook,
  inviteMessage,
  pinksurfingInviteUrl,
} from '@/lib/phone-book-contacts';
import {
  markPersonalChatStarted,
  savedContactToUi,
  savedWithoutActiveChat,
} from '@/lib/saved-contacts';
import { isContactJoined, paychatInviteCodeForUser } from '@/lib/qr-invite';
import type { SessionUser } from '@/lib/types/user';
import type { Contact } from '@pinksurfing/ui';

type Tab = 'saved' | 'phone' | 'directory';

type Props = {
  user: SessionUser | null;
  activePersonalIds: Set<string>;
  startedPersonalIds: string[];
  displayName: string;
  onClose: () => void;
  onStartPersonalChat: (contact: Contact) => void;
  onRequestsChange: (list: BusinessContactRequest[]) => void;
};

export function StartChatOverlay({
  user,
  activePersonalIds,
  startedPersonalIds,
  displayName: inviterName,
  onClose,
  onStartPersonalChat,
  onRequestsChange,
}: Props) {
  const [tab, setTab] = useState<Tab>('saved');
  const [query, setQuery] = useState('');
  const email = user?.email ?? 'guest';
  const [filters, setFilters] = useState<DiscoverFilters>(() =>
    defaultDiscoverFilters(loadFindZip(email))
  );
  const [sentId, setSentId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const paychatId = paychatInviteCodeForUser(user);

  const saved = useMemo(() => {
    const list = savedWithoutActiveChat(email, activePersonalIds);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [email, activePersonalIds, query, startedPersonalIds]);

  const phone = useMemo(() => filterPhoneBook(query), [query]);

  const directory = useMemo(
    () => filterDirectoryByFilters(query, filters),
    [query, filters]
  );

  const patchFilters = (patch: Partial<DiscoverFilters>) => {
    setFilters((f) => {
      const next = { ...f, ...patch };
      if (patch.zip != null) saveFindZip(email, patch.zip);
      return next;
    });
  };

  const handleRequest = (biz: DirectoryBusiness) => {
    if (biz.contactId && isContactJoined('business', biz.contactId)) return;
    if (hasPendingRequest(email, biz.id)) return;
    const next = sendBusinessRequest(email, biz, inviterName, paychatId);
    onRequestsChange(next);
    setSentId(biz.id);
    setTimeout(() => setSentId(null), 2500);
  };

  const copyInvite = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ps-bg)]">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--ps-brd)] bg-[var(--ps-surf)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--ps-white)]">Start a chat</div>
          <div className="text-[9px] text-[var(--ps-muted)]">
            Contacts, phone book, or PinkSurfing businesses
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

      <div className="border-b border-[var(--ps-brd)] px-4 py-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone, or business…"
          className="w-full rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)] px-3 py-2 text-[11px] text-[var(--ps-white)] outline-none placeholder:text-[var(--ps-dim)]"
        />
        <div className="mt-2 flex gap-1">
          {(
            [
              ['saved', 'Your contacts'],
              ['phone', 'Phone book'],
              ['directory', 'PS businesses'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-2.5 py-1 text-[9px] font-medium transition-colors ${
                tab === id
                  ? 'bg-[var(--ps-pink)]/20 text-[var(--ps-pink)]'
                  : 'text-[var(--ps-dim)] hover:text-[var(--ps-muted)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="ps-scroll flex-1 overflow-y-auto p-4">
        {tab === 'saved' && (
          <section>
            <p className="mb-3 text-[9px] text-[var(--ps-dim)]">
              People in your contacts without an active chat on PinkSurfing.
            </p>
            {saved.length === 0 ? (
              <p className="text-[10px] text-[var(--ps-dim)]">No saved contacts without a chat.</p>
            ) : (
              <div className="space-y-1">
                {saved.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      markPersonalChatStarted(email, c.id);
                      onStartPersonalChat(savedContactToUi(c));
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] px-3 py-2.5 text-left hover:border-[var(--ps-cyan)]/40"
                  >
                    <span className="text-[11px] text-[var(--ps-white)]">{c.name}</span>
                    <span className="text-[9px] text-[var(--ps-cyan)]">Start chat</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'phone' && (
          <section>
            <p className="mb-3 text-[9px] text-[var(--ps-dim)]">
              From your phone book — invite those not on PinkSurfing with your link.
            </p>
            <div className="space-y-2">
              {phone.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] text-[var(--ps-white)]">{c.name}</div>
                      <div className="text-[9px] text-[var(--ps-dim)]">{c.phone}</div>
                    </div>
                    {c.onPinkSurfing ? (
                      <span className="text-[8px] text-[var(--ps-green,#5DCAA5)]">On PS</span>
                    ) : (
                      <span className="text-[8px] text-[var(--ps-amber)]">Not on PS</span>
                    )}
                  </div>
                  {!c.onPinkSurfing && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => copyInvite(inviteMessage(c.name, inviterName), c.id)}
                        className="rounded-md border border-[var(--ps-brd)] px-2 py-1 text-[9px] text-[var(--ps-muted)] hover:text-[var(--ps-white)]"
                      >
                        {copied === c.id ? 'Copied!' : 'Copy invite'}
                      </button>
                      <a
                        href={`sms:${c.phone.replace(/\D/g, '')}?body=${encodeURIComponent(inviteMessage(c.name, inviterName))}`}
                        className="rounded-md border border-[var(--ps-pink)]/40 px-2 py-1 text-[9px] text-[var(--ps-pink)]"
                      >
                        SMS invite
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[8px] text-[var(--ps-dim)]">
              Invite link: {pinksurfingInviteUrl(inviterName)}
            </p>
          </section>
        )}

        {tab === 'directory' && (
          <section>
            <CollapsibleFiltersPanel
              filters={filters}
              onChange={patchFilters}
              states={directoryStates()}
              meta={
                <span className="text-[9px] text-[var(--ps-dim)]">
                  {directory.length} businesses
                </span>
              }
              hint="Search businesses — request required without their business card"
            />
            <div className="mt-2 space-y-2">
              {directory.map((biz) => {
                const joined = biz.contactId ? isContactJoined('business', biz.contactId) : false;
                const pending = hasPendingRequest(email, biz.id);
                return (
                  <div
                    key={biz.id}
                    className="rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-[var(--ps-white)]">
                          {biz.businessName}
                        </div>
                        <div className="text-[9px] text-[var(--ps-dim)]">
                          {biz.contactName} · {biz.industry} · {biz.location}
                        </div>
                        <div className="mt-1 font-mono text-[8px] text-[var(--ps-cyan)]">
                          PayChat: {biz.paychatId}
                        </div>
                      </div>
                      {joined ? (
                        <span className="text-[8px] text-[var(--ps-green,#5DCAA5)]">Connected</span>
                      ) : pending || sentId === biz.id ? (
                        <span className="text-[8px] text-[var(--ps-amber)]">Request sent</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRequest(biz)}
                          className="shrink-0 rounded-lg border border-[var(--ps-pink)]/50 px-2 py-1 text-[9px] text-[var(--ps-pink)]"
                        >
                          Request
                        </button>
                      )}
                    </div>
                    {!joined && (
                      <p className="mt-1.5 text-[8px] text-[var(--ps-dim)]">
                        They&apos;ll be prompted to reach you on PayChat first ({paychatId}) before
                        approving.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
