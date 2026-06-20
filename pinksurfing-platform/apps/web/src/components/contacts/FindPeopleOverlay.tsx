'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  approveBusinessRequest,
  declineBusinessRequest,
  formatRequestWhen,
  hasPendingRequest,
  incomingRequests,
  outgoingRequests,
  sendBusinessRequest,
  type BusinessContactRequest,
} from '@/lib/business-contact-requests';
import {
  discoverCatalog,
  defaultDiscoverFilters,
  filterDiscoverPeople,
  findDiscoverPerson,
  loadFindZip,
  saveFindZip,
  type DiscoverFilters,
  type DiscoverPerson,
} from '@/lib/discover-people';
import type { DirectoryBusiness } from '@/lib/ps-business-directory';
import { isContactJoined, paychatInviteCodeForUser } from '@/lib/qr-invite';
import type { SessionUser } from '@/lib/types/user';
import { CollapsibleFiltersPanel } from '@/components/contacts/CollapsibleFiltersPanel';
import { FindMiniProfileBar } from '@/components/contacts/FindMiniProfileBar';
import { FindPeopleGrid } from '@/components/contacts/FindPeopleGrid';
import { ColdContactPromptModal } from '@/components/contacts/ColdContactPromptModal';
import { shouldNudgePayChatBeforeRequest } from '@/lib/cold-contact-likelihood';
import { isSameIndustry } from '@/lib/industry-match';
import { DEFAULT_PROFILE, profileForUser } from '@/lib/profile-data';

type Tab = 'discover' | 'requests';

type Props = {
  user: SessionUser | null;
  displayName: string;
  requests: BusinessContactRequest[];
  onClose: () => void;
  onRefresh: () => void;
  onRequestsChange: (list: BusinessContactRequest[]) => void;
  onOpenPaychat: () => void;
  onVisitProfile: (contactId: string) => void;
};

function toDirectory(p: DiscoverPerson): DirectoryBusiness {
  return {
    id: p.id,
    businessName: p.businessName,
    contactName: p.name,
    industry: p.industry,
    industryCategory: p.industryCategory,
    location: p.location,
    state: p.state,
    lat: p.lat,
    lng: p.lng,
    paychatId: p.paychatId,
    contactId: p.contactId,
  };
}

export function FindPeopleOverlay({
  user,
  displayName,
  requests,
  onClose,
  onRefresh,
  onRequestsChange,
  onOpenPaychat,
  onVisitProfile,
}: Props) {
  const email = user?.email ?? 'guest';
  const myPayId = paychatInviteCodeForUser(user);
  const myIndustry = profileForUser(user, DEFAULT_PROFILE).industry;

  const [tab, setTab] = useState<Tab>('discover');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coldPromptPerson, setColdPromptPerson] = useState<DiscoverPerson | null>(null);
  const [filters, setFilters] = useState<DiscoverFilters>(() =>
    defaultDiscoverFilters(loadFindZip(email))
  );

  const incoming = useMemo(() => incomingRequests(email), [email, requests]);
  const outgoing = useMemo(() => outgoingRequests(email), [email, requests]);

  const filtered = useMemo(
    () => filterDiscoverPeople(discoverCatalog(), filters),
    [filters]
  );

  const selected = selectedId ? findDiscoverPerson(selectedId) : null;

  useEffect(() => {
    if (selectedId && !filtered.some((p) => p.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  const patchFilters = (patch: Partial<DiscoverFilters>) => {
    setFilters((f) => {
      const next = { ...f, ...patch };
      if (patch.zip != null) saveFindZip(email, patch.zip);
      return next;
    });
  };

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const submitRequest = (person: DiscoverPerson) => {
    const next = sendBusinessRequest(email, toDirectory(person), displayName, myPayId);
    onRequestsChange(next);
  };

  const handleRequest = (person: DiscoverPerson) => {
    if (shouldNudgePayChatBeforeRequest(person.coldContactLikelihood)) {
      setColdPromptPerson(person);
      return;
    }
    submitRequest(person);
  };

  const handleApprove = (id: string) => {
    approveBusinessRequest(email, id);
    onRefresh();
  };

  const handleDecline = (id: string) => {
    declineBusinessRequest(email, id);
    onRefresh();
  };

  const handleVisit = (person: DiscoverPerson) => {
    if (person.contactId) onVisitProfile(person.contactId);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--ps-bg)]">
      <ColdContactPromptModal
        open={!!coldPromptPerson}
        personName={coldPromptPerson?.name ?? ''}
        likelihood={coldPromptPerson?.coldContactLikelihood ?? 'moderate'}
        paychatId={coldPromptPerson?.paychatId ?? ''}
        onClose={() => setColdPromptPerson(null)}
        onSendAnyway={() => coldPromptPerson && submitRequest(coldPromptPerson)}
        onOpenPaychat={onOpenPaychat}
      />
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--ps-brd)] bg-[var(--ps-surf)] px-3 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-[var(--ps-brd)] px-2 py-1 text-[10px] text-[var(--ps-muted)] hover:text-[var(--ps-white)]"
        >
          ← Back
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--ps-white)]">Find people</div>
          <div className="text-[8px] text-[var(--ps-dim)]">Discover · filter · connect</div>
        </div>
        <div className="flex rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)] p-0.5">
          <button
            type="button"
            onClick={() => setTab('discover')}
            className={`rounded-md px-2.5 py-1 text-[9px] font-medium ${
              tab === 'discover'
                ? 'bg-[var(--ps-pink)]/25 text-[var(--ps-pink)]'
                : 'text-[var(--ps-dim)]'
            }`}
          >
            Discover
          </button>
          <button
            type="button"
            onClick={() => setTab('requests')}
            className={`relative rounded-md px-2.5 py-1 text-[9px] font-medium ${
              tab === 'requests'
                ? 'bg-[var(--ps-pink)]/25 text-[var(--ps-pink)]'
                : 'text-[var(--ps-dim)]'
            }`}
          >
            Requests
            {incoming.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--ps-pink)] px-0.5 text-[6px] font-bold text-[var(--ps-card)]">
                {incoming.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {tab === 'discover' ? (
        <>
          {selected && (
            <FindMiniProfileBar
              person={selected}
              onVisit={() => handleVisit(selected)}
              connected={
                selected.contactId ? isContactJoined('business', selected.contactId) : false
              }
              requestSent={hasPendingRequest(email, selected.id)}
              onRequest={
                selected.contactId && isContactJoined('business', selected.contactId)
                  ? undefined
                  : () => handleRequest(selected)
              }
            />
          )}

          <CollapsibleFiltersPanel
            filters={filters}
            onChange={patchFilters}
            meta={
              <span className="text-[9px] text-[var(--ps-dim)]">{filtered.length} people</span>
            }
            hint="Tap once for mini profile"
          />

          <div className="ps-scroll min-h-0 flex-1 overflow-y-auto">
            <FindPeopleGrid
              people={filtered}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>
        </>
      ) : (
        <>
          <div className="border-b border-[var(--ps-brd)] bg-[var(--ps-card2)] px-3 py-2">
            <div className="text-[8px] text-[var(--ps-dim)]">Your PayChat ID</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-[var(--ps-cyan)]">{myPayId}</span>
              <button
                type="button"
                onClick={onOpenPaychat}
                className="rounded-md border border-[var(--ps-pink)]/40 px-2 py-0.5 text-[8px] text-[var(--ps-pink)]"
              >
                Open PayChat
              </button>
            </div>
          </div>

          <div className="ps-scroll flex-1 overflow-y-auto p-3">
            <section className="mb-4">
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-[var(--ps-dim)]">
                Incoming ({incoming.length})
              </div>
              {incoming.length === 0 ? (
                <p className="text-[10px] text-[var(--ps-dim)]">No pending incoming requests.</p>
              ) : (
                <div className="space-y-2">
                  {incoming.map((r) => (
                    <RequestCard
                      key={r.id}
                      request={r}
                      variant="incoming"
                      sameIndustry={isSameIndustry(r.industry, myIndustry)}
                      onApprove={() => handleApprove(r.id)}
                      onDecline={() => handleDecline(r.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-[var(--ps-dim)]">
                Pending — you requested ({outgoing.length})
              </div>
              {outgoing.length === 0 ? (
                <p className="text-[10px] text-[var(--ps-dim)]">
                  Send requests from Discover when you find someone new.
                </p>
              ) : (
                <div className="space-y-2">
                  {outgoing.map((r) => (
                    <RequestCard key={r.id} request={r} variant="outgoing" />
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function RequestCard({
  request,
  variant,
  sameIndustry = false,
  onApprove,
  onDecline,
}: {
  request: BusinessContactRequest;
  variant: 'incoming' | 'outgoing';
  sameIndustry?: boolean;
  onApprove?: () => void;
  onDecline?: () => void;
}) {
  const statusLabel =
    request.status === 'approved'
      ? 'Approved'
      : request.status === 'declined'
        ? 'Declined'
        : 'Pending';

  return (
    <div className="rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-[11px] font-medium text-[var(--ps-white)]">
              {variant === 'incoming' ? request.fromName : request.toBusinessName}
            </div>
            {variant === 'incoming' && sameIndustry && (
              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--ps-green,#5DCAA5)]/20 text-[10px] font-bold text-[var(--ps-green,#5DCAA5)]"
                title={`Same industry — ${request.industry}`}
                aria-label={`Same industry — ${request.industry}`}
              >
                ✓
              </span>
            )}
          </div>
          <div className="text-[9px] text-[var(--ps-dim)]">
            {request.industry} · {formatRequestWhen(request.createdAt)}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] ${
            request.status === 'pending'
              ? 'bg-[var(--ps-amber)]/15 text-[var(--ps-amber)]'
              : request.status === 'approved'
                ? 'bg-[var(--ps-green,#5DCAA5)]/15 text-[var(--ps-green,#5DCAA5)]'
                : 'bg-[var(--ps-dim)]/15 text-[var(--ps-dim)]'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <p className="mt-2 text-[10px] text-[var(--ps-muted)]">{request.message}</p>

      <div className="mt-2 rounded-lg bg-[var(--ps-surf)] px-2 py-1.5">
        <div className="text-[8px] text-[var(--ps-dim)]">PayChat ID</div>
        <div className="font-mono text-[10px] text-[var(--ps-cyan)]">{request.paychatId}</div>
        <p className="mt-0.5 text-[8px] text-[var(--ps-dim)]">
          Connect on PayChat before approving a business contact.
        </p>
      </div>

      {variant === 'incoming' && request.status === 'pending' && onApprove && onDecline && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="flex-1 rounded-lg bg-[var(--ps-pink)] py-1.5 text-[10px] font-medium text-[var(--ps-card)]"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="rounded-lg border border-[var(--ps-brd)] px-3 py-1.5 text-[10px] text-[var(--ps-muted)]"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
