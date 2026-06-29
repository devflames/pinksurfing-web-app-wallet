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
  approveBusinessRequestApi,
  cancelBusinessRequestApi,
  declineBusinessRequestApi,
  fetchBusinessRequests,
  hasPendingRequestLive,
  incomingRequestsLive,
  outgoingRequestsLive,
  sendBusinessRequestApi,
} from '@/lib/business-contact-requests-api';
import { isChatLive, fetchDiscoverPeople } from '@/lib/chat-api';
import {
  discoverCatalog,
  defaultDiscoverFilters,
  filterDiscoverPeople,
  findDiscoverPerson,
  liveAccountToDiscoverPerson,
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
  token?: string | null;
  userId?: string | null;
  displayName: string;
  requests: BusinessContactRequest[];
  onClose: () => void;
  onRefresh: () => void;
  onRequestsChange: (list: BusinessContactRequest[]) => void;
  onOpenPaychat: () => void;
  onVisitProfile: (contactId: string) => void;
  onContactsRefresh?: () => void;
};

function peerUserIdFromPerson(p: DiscoverPerson): string | undefined {
  if (p.userId) return p.userId;
  if (p.contactId?.startsWith('live-')) return p.contactId.slice(5);
  return undefined;
}

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
  token,
  userId,
  displayName,
  requests,
  onClose,
  onRefresh,
  onRequestsChange,
  onOpenPaychat,
  onVisitProfile,
  onContactsRefresh,
}: Props) {
  const email = user?.email ?? 'guest';
  const myPayId = paychatInviteCodeForUser(user);
  const myIndustry = profileForUser(user, DEFAULT_PROFILE).industry;
  const live = isChatLive() && !!token && !!userId;

  const [tab, setTab] = useState<Tab>('discover');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coldPromptPerson, setColdPromptPerson] = useState<DiscoverPerson | null>(null);
  const [outgoingOpen, setOutgoingOpen] = useState(false);
  const [livePeople, setLivePeople] = useState<DiscoverPerson[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DiscoverFilters>(() =>
    defaultDiscoverFilters(loadFindZip(email))
  );

  useEffect(() => {
    if (!live || !token) {
      setLivePeople([]);
      setLiveError(null);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    setLiveError(null);
    void fetchDiscoverPeople(token)
      .then((rows) => {
        if (cancelled) return;
        setLivePeople((rows ?? []).map((row, i) => liveAccountToDiscoverPerson(row, i)));
      })
      .catch((e) => {
        if (!cancelled) {
          setLiveError(e instanceof Error ? e.message : 'Could not load people');
          setLivePeople([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [live, token]);

  const catalog = live ? livePeople : discoverCatalog();

  const incoming = useMemo(
    () => (live ? incomingRequestsLive(requests, userId) : incomingRequests(email)),
    [email, live, requests, userId]
  );
  const outgoing = useMemo(
    () => (live ? outgoingRequestsLive(requests, userId) : outgoingRequests(email)),
    [email, live, requests, userId]
  );
  const pendingOutgoing = outgoing.filter((r) => r.status === 'pending');

  useEffect(() => {
    if (!live || !token) return;
    void onRefresh();
  }, [live, token, onRefresh]);

  useEffect(() => {
    if (live && incoming.length > 0) setTab('requests');
    if (live && incoming.length === 0 && pendingOutgoing.length > 0) {
      setTab('requests');
      setOutgoingOpen(true);
    }
  }, [live, incoming.length, pendingOutgoing.length]);

  const filtered = useMemo(
    () => filterDiscoverPeople(catalog, filters),
    [catalog, filters]
  );

  const selected = selectedId ? findDiscoverPerson(selectedId, catalog) : null;

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

  const submitRequest = async (person: DiscoverPerson) => {
    if (live && token) {
      const toUserId = peerUserIdFromPerson(person);
      if (!toUserId) {
        window.alert('Could not send request — this person is not available.');
        return;
      }
      try {
        await sendBusinessRequestApi(token, {
          toUserId,
          toBusinessId: person.id,
          toBusinessName: person.businessName,
          toContactName: person.name,
          industry: person.industry,
          industryCategory: person.industryCategory,
          paychatId: person.paychatId,
          fromName: displayName,
          message: `Request to connect with ${person.businessName} via PinkSurfing search.`,
        });
        const next = await fetchBusinessRequests(token);
        onRequestsChange(next);
        setTab('requests');
        setOutgoingOpen(true);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Could not send request');
      }
      return;
    }
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

  const handleApprove = async (id: string) => {
    if (live && token) {
      try {
        await approveBusinessRequestApi(token, id);
        const next = await fetchBusinessRequests(token);
        onRequestsChange(next);
        onRefresh();
        onContactsRefresh?.();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Could not approve request');
      }
      return;
    }
    const next = approveBusinessRequest(email, id);
    onRequestsChange(next);
  };

  const handleDecline = async (id: string) => {
    if (live && token) {
      try {
        await declineBusinessRequestApi(token, id);
        const next = await fetchBusinessRequests(token);
        onRequestsChange(next);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Could not decline request');
      }
      return;
    }
    const next = declineBusinessRequest(email, id);
    onRequestsChange(next);
  };

  const handleCancel = async (id: string) => {
    if (live && token) {
      try {
        await cancelBusinessRequestApi(token, id);
        const next = await fetchBusinessRequests(token);
        onRequestsChange(next);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Could not cancel request');
      }
      return;
    }
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
              requestSent={
                live && selected
                  ? hasPendingRequestLive(
                      requests,
                      peerUserIdFromPerson(selected) ?? selected.id,
                      userId
                    )
                  : hasPendingRequest(email, selected.id)
              }
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
              <span className="text-[9px] text-[var(--ps-dim)]">
                {liveLoading ? 'Loading…' : `${filtered.length} people`}
                {live ? ' · live' : ''}
              </span>
            }
            hint={
              live
                ? 'Real PinkSurfing accounts — tap to connect'
                : 'Tap once for mini profile'
            }
          />

          {liveError && (
            <p className="px-3 py-2 text-[10px] text-[var(--ps-red)]">{liveError}</p>
          )}

          <div className="ps-scroll min-h-0 flex-1 overflow-y-auto">
            {liveLoading ? (
              <p className="p-4 text-center text-[10px] text-[var(--ps-dim)]">Loading people…</p>
            ) : live && filtered.length === 0 ? (
              <div className="p-4 text-center text-[10px] text-[var(--ps-dim)]">
                <p className="mb-2 text-[var(--ps-muted)]">No other live users yet.</p>
                <p>Share your QR from the Share tab, or invite someone to sign up on PinkSurfing.</p>
              </div>
            ) : (
              <FindPeopleGrid
                people={filtered}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            )}
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
            {live && pendingOutgoing.length > 0 && incoming.length === 0 && (
              <div className="mb-3 rounded-xl border border-[var(--ps-amber)]/30 bg-[var(--ps-amber)]/10 px-3 py-2.5 text-[10px] text-[var(--ps-muted)]">
                You sent {pendingOutgoing.length} request{pendingOutgoing.length === 1 ? '' : 's'} —{' '}
                <strong className="text-[var(--ps-white)]">only the other person can Approve</strong>.
                They will see it under Incoming requests when they sign in.
              </div>
            )}

            <section className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--ps-pink-soft)]">
                  Incoming requests
                </div>
                <span className="rounded-full bg-[var(--ps-pink)]/15 px-2 py-0.5 text-[8px] font-medium text-[var(--ps-pink)]">
                  {incoming.length} open
                </span>
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

            <section className="rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card2)]">
              <button
                type="button"
                onClick={() => setOutgoingOpen((open) => !open)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                aria-expanded={outgoingOpen}
              >
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--ps-dim)]">
                    Outgoing requests
                  </div>
                  <div className="text-[8px] text-[var(--ps-dim)]">
                    {outgoing.filter((r) => r.status === 'pending').length} pending ·{' '}
                    {outgoing.filter((r) => r.status === 'approved').length} accepted
                  </div>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] text-[var(--ps-muted)]">
                  <span className="rounded-full bg-[var(--ps-surf)] px-2 py-0.5 text-[8px]">
                    {outgoing.length}
                  </span>
                  {outgoingOpen ? '▾' : '▸'}
                </span>
              </button>
              {outgoingOpen && (
                <div className="space-y-2 border-t border-[var(--ps-brd)] p-3">
                  {outgoing.length === 0 ? (
                    <p className="text-[10px] text-[var(--ps-dim)]">
                      Send requests from Discover when you find someone new.
                    </p>
                  ) : (
                    outgoing.map((r) => (
                      <RequestCard
                        key={r.id}
                        request={r}
                        variant="outgoing"
                        onCancel={
                          live && r.status === 'pending' ? () => handleCancel(r.id) : undefined
                        }
                      />
                    ))
                  )}
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
  onCancel,
}: {
  request: BusinessContactRequest;
  variant: 'incoming' | 'outgoing';
  sameIndustry?: boolean;
  onApprove?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
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
        {variant === 'incoming' && request.status === 'pending' && (
          <p className="mt-0.5 text-[8px] text-[var(--ps-dim)]">
            Optional: connect on PayChat first, then approve to add them as a business contact.
          </p>
        )}
      </div>

      {variant === 'outgoing' && request.status === 'pending' && (
        <p className="mt-2 rounded-lg bg-[var(--ps-amber)]/10 px-2 py-1.5 text-[9px] text-[var(--ps-amber)]">
          Waiting for {request.toBusinessName} to approve — check back after they accept.
        </p>
      )}

      {variant === 'outgoing' && request.status === 'approved' && (
        <p className="mt-2 rounded-lg bg-[var(--ps-green,#5DCAA5)]/10 px-2 py-1.5 text-[9px] text-[var(--ps-green,#5DCAA5)]">
          They accepted your request
          {request.acceptedAt ? ` · ${formatRequestWhen(request.acceptedAt)}` : ''}
        </p>
      )}

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

      {variant === 'outgoing' && request.status === 'pending' && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 w-full rounded-lg border border-[var(--ps-brd)] py-1.5 text-[10px] text-[var(--ps-muted)] hover:text-[var(--ps-white)]"
        >
          Cancel request
        </button>
      )}
    </div>
  );
}
