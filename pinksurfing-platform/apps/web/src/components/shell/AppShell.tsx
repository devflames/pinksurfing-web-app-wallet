'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppSection, ChatTab, Contact, PaychatDirection } from '@pinksurfing/ui';
import { ActiveContractBanner } from '@/components/business/ActiveContractBanner';
import { BtcSwapView } from '@/components/business/BtcSwapView';
import { BusinessViewTabs } from '@/components/business/BusinessViewTabs';
import { QrJoinModal } from '@/components/business/QrJoinModal';
import { ContactDetailPanel } from '@/components/business/ContactDetailPanel';
import { ExecBar } from '@/components/business/ExecBar';
import { ChatInput } from '@/components/chat/ChatInput';
import { MessageThread } from '@/components/chat/MessageThread';
import { ContractCard } from '@/components/contracts/ContractCard';
import { CreateContractModal } from '@/components/contracts/CreateContractModal';
import { PayChatGate } from '@/components/paychat/PayChatGate';
import { PayChatReceiveCard } from '@/components/paychat/PayChatReceiveCard';
import { PayChatDialOverlay } from '@/components/paychat/PayChatDialOverlay';
import { PayChatDirectionTabs } from '@/components/paychat/PayChatDirectionTabs';
import { SquareCheckoutModal } from '@/components/paychat/SquareCheckoutModal';
import { PayChatCheckoutModal } from '@/components/paychat/PayChatCheckoutModal';
import { loadPayChatSettings, savePayChatSettings } from '@/lib/paychat-settings-storage';
import { formatPaychatPrice, paychatPriceForStep } from '@/lib/paychat-pricing';
import { WalletPanel } from '@/components/wallet/WalletPanel';
import { BottomNav, SECTION_TITLES } from '@/components/nav/BottomNav';
import { ProfileView } from '@/components/profile/ProfileView';
import { BusinessProfileModal } from '@/components/profile/BusinessProfileModal';
import { businessProfileForContact } from '@/lib/business-profile-data';
import { ExploreView } from '@/components/explore/ExploreView';
import type { ExploreScreenId } from '@/lib/explore-types';
import { ShopView } from '@/components/shop/ShopView';
import { ShareView } from '@/components/share/ShareView';
import { SectionPanel } from '@/components/shell/SectionPanel';
import { ShellChrome } from '@/components/ui/ActionToast';
import {
  ShellNavProvider,
  type ShellNavOptions,
  type ShopMode,
} from '@/lib/shell-nav-context';
import { useAuth } from '@/lib/auth-context';
import { displayName } from '@/lib/auth-storage';
import type { BusinessView } from '@/lib/business-view';
import { getChatSession, STATE_EVENT_LABELS } from '@/lib/chat-session';
import {
  createBusinessContract,
  isContractsLive,
  loadContractsByConversation,
  runContractAction,
} from '@/lib/contracts-service';
import {
  businessConversationForContact,
  DEMO_CONTACTS,
  peerUserIdForContact,
} from '@/lib/demo-data';
import type { CallMode } from '@/lib/types/call';
import {
  appendCallHistory,
  loadCallHistory,
  VIDEO_CALL_RATE_PER_MIN_USD,
  videoCallCost,
  type CallHistoryEntry,
} from '@/lib/call-history-storage';
import type { BusinessContract, ContractActionType } from '@/lib/types/contract';
import { contractId } from '@/lib/types/contract';
import { useLiveChat } from '@/lib/use-live-chat';
import { useContacts } from '@/lib/use-contacts';
import { isChatLive, fetchPaychatRoomStatus } from '@/lib/chat-api';
import { CallOverlay } from '@/components/calls/CallOverlay';
import { CallHeaderAction } from '@/components/calls/CallHeaderAction';
import { CallsContactsOverlay } from '@/components/calls/CallsContactsOverlay';
import { FindPeopleOverlay } from '@/components/contacts/FindPeopleOverlay';
import { EditTeamsOverlay } from '@/components/groups/EditTeamsOverlay';
import { GroupAvatar } from '@/components/groups/GroupAvatar';
import { groupAvatarUrlsFor, loadGroupMemberIds } from '@/lib/group-teams';
import { HomeSidebarActions } from '@/components/contacts/HomeSidebarActions';
import { StartChatOverlay } from '@/components/contacts/StartChatOverlay';
import { QrAddIcon } from '@/components/icons/QrAddIcon';
import { useContactPreview } from '@/lib/use-chat-session';
import {
  incomingRequests,
  loadBusinessRequests,
  type BusinessContactRequest,
} from '@/lib/business-contact-requests';
import {
  loadStartedPersonalIds,
  resolveSavedOrDemo,
  SAVED_PERSONAL_CONTACTS,
  savedContactToUi,
  type SavedContact,
} from '@/lib/saved-contacts';

import { joinContactViaQr, paychatInviteCodeForUser, registerUserPaychatQr, registerUserBusinessQr, consumePendingQrJoin, consumeQrJoinResult } from '@/lib/qr-invite';
import { resolveRecipientChiaAddress } from '@/lib/paychat-vault-payment';
import { loadWalletIdentity } from '@/lib/wallet-identity-storage';
import { executeQrJoin } from '@/lib/qr-join-service';
import type { BusinessCardSnapshot } from '@/lib/business-card-types';
import {
  businessAvatarRing,
  businessAvatarRingClass,
  contractsForBusinessContact,
  type BusinessAvatarRing,
} from '@/lib/business-chat-ring';
import { useAgoraCall } from '@/lib/use-agora-call';


function chatSectionFor(section: AppSection): boolean {
  return section === 'home' || section === 'paychat';
}

type HomeMainOverlay = 'calls' | 'start-chat' | 'find';

const TABS: { id: ChatTab; label: string }[] = [
  { id: 'personal', label: 'Personal' },
  { id: 'business', label: 'Business' },
  { id: 'paychat', label: 'PayChat' },
];

function paychatDir(contact: Contact): PaychatDirection {
  return contact.paychatDirection ?? 'outgoing';
}

function Avatar({
  contact,
  size = 34,
  onClick,
  clickable,
  businessRing,
}: {
  contact: Contact;
  size?: number;
  onClick?: () => void;
  clickable?: boolean;
  businessRing?: BusinessAvatarRing;
}) {
  const ringCls = businessRing ? businessAvatarRingClass(businessRing) : '';
  const inner = (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${ringCls} ${
        clickable && !businessRing
          ? 'ring-2 ring-transparent transition-all hover:ring-[var(--ps-green)]/50'
          : clickable
            ? 'transition-opacity hover:opacity-90'
            : ''
      }`}
      style={{
        width: size,
        height: size,
        background: contact.isGroup
          ? 'linear-gradient(135deg, #9747ff33, #4a90d933)'
          : contact.bg,
        color: contact.color,
      }}
    >
      {contact.isGroup ? '👥' : contact.initials}
    </div>
  );

  if (clickable && onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="shrink-0 rounded-full"
        title="View business profile"
      >
        {inner}
      </button>
    );
  }

  return inner;
}

function ContactRow({
  contact,
  active,
  unlockedPaychat,
  onSelect,
  onViewBusinessProfile,
  groupAvatarUrls,
  onOpenGroupEdit,
  businessRing,
}: {
  contact: Contact;
  active: boolean;
  unlockedPaychat: Record<string, boolean>;
  onSelect: () => void;
  onViewBusinessProfile?: (contactId: string) => void;
  groupAvatarUrls?: string[];
  onOpenGroupEdit?: () => void;
  businessRing?: BusinessAvatarRing;
}) {
  const live = useContactPreview(contact.id, contact.preview);
  const isBusiness = contact.type === 'business';
  const isPaychat = contact.type === 'paychat';
  const lockedPaychat =
    isPaychat &&
    paychatDir(contact) === 'outgoing' &&
    !contact.unlocked &&
    !unlockedPaychat[contact.id];
  const incomingPaychat = isPaychat && paychatDir(contact) === 'incoming';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`mx-2 mb-2 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition-all ${
        active
          ? isBusiness
            ? 'border-[var(--ps-green)]/60 bg-gradient-to-r from-[var(--ps-green)]/15 to-transparent shadow-[0_0_12px_rgba(46,204,113,0.15)]'
            : incomingPaychat
              ? 'border-[var(--ps-green)]/60 bg-gradient-to-r from-[var(--ps-green)]/15 to-transparent shadow-[0_0_12px_rgba(46,204,113,0.15)]'
              : isPaychat
                ? 'border-[var(--ps-cyan)]/60 bg-gradient-to-r from-[var(--ps-cyan)]/15 to-transparent shadow-[0_0_12px_rgba(0,184,255,0.12)]'
                : 'border-[var(--ps-pink)]/50 bg-[var(--ps-card2)]'
          : incomingPaychat
            ? 'border-[var(--ps-cyan)]/25 bg-[var(--ps-card)] hover:border-[var(--ps-cyan)]/40'
            : isPaychat
              ? 'border-[var(--ps-cyan)]/20 bg-[var(--ps-card)] hover:border-[var(--ps-cyan)]/35'
              : 'border-[var(--ps-brd)]/30 bg-[var(--ps-card)] hover:border-[var(--ps-pink)]/40'
      }`}
    >
      {contact.isGroup && groupAvatarUrls ? (
        <GroupAvatar
          urls={groupAvatarUrls}
          onClick={onOpenGroupEdit}
          businessRing={businessRing}
        />
      ) : (
        <Avatar
          contact={contact}
          clickable={isBusiness}
          businessRing={isBusiness ? businessRing : undefined}
          onClick={
            isBusiness && onViewBusinessProfile
              ? () => onViewBusinessProfile(contact.id)
              : undefined
          }
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 truncate text-[11px] font-medium text-[var(--ps-white)]">
          {contact.name}
          {contact.biz && (
            <span className="rounded border border-[var(--ps-green)]/40 bg-[var(--ps-green)]/10 px-1 text-[8px] text-[var(--ps-green)]">
              Biz
            </span>
          )}
          {contact.isGroup && (
            <span className="rounded border border-[#9747ff]/40 bg-[#9747ff]/10 px-1 text-[8px] text-[#9747ff]">
              Group
            </span>
          )}
          {incomingPaychat && (
            <span className="rounded border border-[var(--ps-cyan)]/40 bg-[var(--ps-cyan)]/10 px-1 text-[8px] text-[var(--ps-cyan)]">
              Pays you
            </span>
          )}
          {isPaychat && !incomingPaychat && (
            <span className="rounded border border-[var(--ps-pink)]/40 bg-[var(--ps-pink)]/10 px-1 text-[8px] text-[var(--ps-pink)]">
              You pay
            </span>
          )}
          {lockedPaychat && (
            <span className="rounded border border-[var(--ps-pink)]/40 bg-[var(--ps-pink)]/10 px-1 text-[8px] text-[var(--ps-pink)]">
              Locked
            </span>
          )}
        </div>
        <div className="truncate text-[10px] text-[var(--ps-muted)]">
          {lockedPaychat ? 'Scan card to unlock' : live.preview}
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[9px] text-[var(--ps-dim)]">{live.time || contact.time}</span>
        {contact.unread ? (
          <span className="flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-[#9747ff] px-0.5 text-[8px] font-bold text-white">
            {contact.unread}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function AppShell() {
  const { token, user, userId, loading: authLoading, error: authError, logout } = useAuth();
  const [section, setSection] = useState<AppSection>('home');
  const [homeTab, setHomeTab] = useState<ChatTab>('business');
  const [homeActiveId, setHomeActiveId] = useState('c3');
  const [paychatActiveId, setPaychatActiveId] = useState('c6');
  const {
    loading: contactsLoading,
    error: contactsError,
    getContactsForTab,
    resolveContact,
    resolvePeerUserId,
    refreshJoined,
  } = useContacts(token);
  const [businessView, setBusinessView] = useState<BusinessView>('chat');
  const [contracts, setContracts] = useState<BusinessContract[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractsError, setContractsError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [unlockedPaychat, setUnlockedPaychat] = useState<Record<string, boolean>>({ c7: true });
  const [squareContract, setSquareContract] = useState<BusinessContract | null>(null);
  const [paychatCheckout, setPaychatCheckout] = useState<{
    contactId: string;
    name: string;
    amountUsd: number;
    toUserId: string;
    recipientChiaAddress?: string | null;
  } | null>(null);
  const [paychatServerAsk, setPaychatServerAsk] = useState<Record<string, number>>({});
  const [mobileChatFocused, setMobileChatFocused] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalKind, setQrModalKind] = useState<'business' | 'paychat'>('business');
  const [shopMode, setShopMode] = useState<ShopMode>('browse');
  const [exploreScreen, setExploreScreen] = useState<ExploreScreenId>('list');
  const [search, setSearch] = useState('');
  const [callError, setCallError] = useState<string | null>(null);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [videoCallCheckout, setVideoCallCheckout] = useState<{
    contactId: string;
    name: string;
  } | null>(null);
  const callLiveStartedAt = useRef<number | null>(null);
  const callContactIdRef = useRef<string | null>(null);
  const endingCallRef = useRef(false);
  const contractAnchorRef = useRef<HTMLDivElement>(null);
  const [paychatSub, setPaychatSub] = useState<PaychatDirection>('outgoing');
  const paychatSubTouched = useRef(false);
  const [paychatSettings, setPaychatSettings] = useState(() => loadPayChatSettings(''));
  const [showPaychatDial, setShowPaychatDial] = useState(false);
  const [homeMainOverlay, setHomeMainOverlay] = useState<HomeMainOverlay | null>(null);
  const [businessRequests, setBusinessRequests] = useState<BusinessContactRequest[]>([]);
  const [startedPersonalTick, setStartedPersonalTick] = useState(0);
  const [groupEditMode, setGroupEditMode] = useState(false);
  const [businessProfileId, setBusinessProfileId] = useState<string | null>(null);
  const businessProfile = useMemo(
    () => (businessProfileId ? businessProfileForContact(businessProfileId) : null),
    [businessProfileId]
  );

  const openBusinessProfile = useCallback((contactId: string) => {
    if (businessProfileForContact(contactId)) {
      setBusinessProfileId(contactId);
    }
  }, []);
  const agora = useAgoraCall();

  const isChatSection = chatSectionFor(section);
  const chatTabs = useMemo(() => {
    if (section === 'paychat') return TABS.filter((t) => t.id === 'paychat');
    return TABS.filter((t) => t.id !== 'paychat');
  }, [section]);

  const effectiveTab: ChatTab = section === 'paychat' ? 'paychat' : homeTab;
  const activeId = section === 'paychat' ? paychatActiveId : homeActiveId;

  const setActiveForSection = useCallback(
    (id: string) => {
      if (section === 'paychat') setPaychatActiveId(id);
      else setHomeActiveId(id);
    },
    [section]
  );

  const extraPersonalContacts = useMemo(() => {
    void startedPersonalTick;
    return loadStartedPersonalIds(user?.email ?? 'guest')
      .map((id) => SAVED_PERSONAL_CONTACTS.find((c) => c.id === id))
      .filter((c): c is SavedContact => !!c)
      .map(savedContactToUi);
  }, [user?.email, startedPersonalTick]);

  const list = useMemo(() => {
    if (!isChatSection) return [];
    let base = getContactsForTab(effectiveTab);
    if (section === 'home' && effectiveTab === 'personal') {
      const seen = new Set(base.map((c) => c.id));
      base = [...base, ...extraPersonalContacts.filter((c) => !seen.has(c.id))];
    }
    if (section === 'paychat') {
      base = base.filter((c) => paychatDir(c) === paychatSub);
    }
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) => c.name.toLowerCase().includes(q));
  }, [
    isChatSection,
    effectiveTab,
    search,
    getContactsForTab,
    section,
    paychatSub,
    extraPersonalContacts,
  ]);

  const paychatCounts = useMemo(() => {
    const all = getContactsForTab('paychat');
    return {
      incoming: all.filter((c) => paychatDir(c) === 'incoming').length,
      outgoing: all.filter((c) => paychatDir(c) === 'outgoing').length,
    };
  }, [getContactsForTab]);

  const connectedContacts = useMemo(() => {
    if (section === 'paychat') return getContactsForTab('paychat');
    return [...getContactsForTab('personal'), ...getContactsForTab('business')];
  }, [section, getContactsForTab]);

  useEffect(() => {
    setPaychatSettings(loadPayChatSettings(user?.email ?? ''));
  }, [user?.email]);

  useEffect(() => {
    if (!user) return;
    const walletId = loadWalletIdentity(user.email ?? '');
    registerUserPaychatQr(
      user,
      displayName(user),
      paychatSettings.accepting ? paychatPriceForStep(paychatSettings.step) : undefined,
      walletId?.chiaAddress
    );
    registerUserBusinessQr(user, displayName(user));
  }, [user, paychatSettings.step, paychatSettings.accepting]);

  useEffect(() => {
    setCallHistory(loadCallHistory(user?.email ?? 'guest'));
  }, [user?.email]);

  useEffect(() => {
    setBusinessRequests(loadBusinessRequests(user?.email ?? 'guest'));
  }, [user?.email]);

  useEffect(() => {
    if (section !== 'home') setHomeMainOverlay(null);
  }, [section]);

  useEffect(() => {
    if (agora.status === 'live') {
      callLiveStartedAt.current = Date.now();
    }
  }, [agora.status]);

  useEffect(() => {
    if (section !== 'paychat') setShowPaychatDial(false);
  }, [section]);

  useEffect(() => {
    if (section !== 'paychat') {
      paychatSubTouched.current = false;
      return;
    }
    if (paychatSubTouched.current) return;
    const { incoming, outgoing } = paychatCounts;
    setPaychatSub(incoming > outgoing ? 'incoming' : 'outgoing');
  }, [section, paychatCounts]);

  const selectPaychatSub = useCallback(
    (dir: PaychatDirection) => {
      paychatSubTouched.current = true;
      setPaychatSub(dir);
      const first = getContactsForTab('paychat').find((c) => paychatDir(c) === dir);
      if (first) setPaychatActiveId(first.id);
    },
    [getContactsForTab]
  );

  const updatePaychatSettings = useCallback(
    (patch: Partial<typeof paychatSettings>) => {
      const next = { ...paychatSettings, ...patch };
      setPaychatSettings(next);
      savePayChatSettings(user?.email ?? '', next);
    },
    [paychatSettings, user?.email]
  );

  const active =
    resolveContact(activeId) ??
    resolveSavedOrDemo(activeId) ??
    DEMO_CONTACTS[activeId] ??
    list[0];

  const activePersonalIds = useMemo(
    () => new Set(getContactsForTab('personal').map((c) => c.id)),
    [getContactsForTab]
  );

  const incomingRequestCount = useMemo(
    () => incomingRequests(user?.email ?? 'guest').length,
    [user?.email, businessRequests]
  );
  const peerUserId = active ? resolvePeerUserId(active) : null;
  const bizConv = active?.type === 'business' ? businessConversationForContact(active.id) : null;
  const primaryContract = contracts[0] ?? null;

  const businessAvatarRings = useMemo(() => {
    if (effectiveTab !== 'business') return {} as Record<string, BusinessAvatarRing>;
    const map: Record<string, BusinessAvatarRing> = {};
    for (const c of getContactsForTab('business')) {
      map[c.id] = businessAvatarRing(contractsForBusinessContact(c.id));
    }
    return map;
  }, [effectiveTab, getContactsForTab, contracts]);
  const paychatUnlocked =
    active?.type === 'paychat' &&
    (paychatDir(active) === 'incoming' || active.unlocked || unlockedPaychat[active.id]);

  const activePaychatAskUsd =
    active?.type === 'paychat'
      ? (paychatServerAsk[active.id] ?? active.askUsd ?? 0)
      : 0;

  const chatLive = isChatLive();
  const {
    messages,
    send,
    sendAttachment,
    appendState,
    loading: chatLoading,
    uploading,
    error: chatError,
  } = useLiveChat({
    token,
    userId,
    contact: active ?? DEMO_CONTACTS.c1,
    peerUserId,
    fallbackPreview: active?.preview ?? '',
  });

  useEffect(() => {
    if (!chatLive || !token || !userId || !active || active.type !== 'paychat') return;
    if (paychatDir(active) !== 'outgoing') return;
    const peerId = resolvePeerUserId(active);
    if (!peerId) return;

    let cancelled = false;
    fetchPaychatRoomStatus(token, userId, peerId)
      .then((status) => {
        if (cancelled) return;
        setPaychatServerAsk((prev) => ({ ...prev, [active.id]: status.dialAskAmount }));
        if (status.access) {
          setUnlockedPaychat((u) => ({ ...u, [active.id]: true }));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [chatLive, token, userId, active, resolvePeerUserId]);

  useEffect(() => {
    if (!isChatSection || list.length === 0) return;
    if (!list.some((c) => c.id === activeId)) {
      setActiveForSection(list[0].id);
    }
  }, [isChatSection, list, activeId, setActiveForSection]);

  const loadContracts = useCallback(async () => {
    if (!bizConv) {
      setContracts([]);
      return;
    }
    if (isContractsLive() && !token) {
      setContracts([]);
      return;
    }
    setContractsLoading(true);
    setContractsError(null);
    try {
      const data = await loadContractsByConversation(token ?? '', bizConv.conversationId);
      setContracts(data);
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to load contracts');
      setContracts([]);
    } finally {
      setContractsLoading(false);
    }
  }, [token, bizConv]);

  useEffect(() => {
    const isBusinessChat =
      isChatSection &&
      effectiveTab === 'business' &&
      active?.type === 'business' &&
      !!bizConv;
    if (!isBusinessChat) {
      setContractsError(null);
      if (!bizConv) setContracts([]);
      return;
    }
    loadContracts();
  }, [isChatSection, effectiveTab, active?.type, bizConv, loadContracts]);

  const emitContractState = useCallback(
    (c: BusinessContract) => {
      const ev = STATE_EVENT_LABELS[c.state];
      if (ev && active?.type === 'business') {
        appendState(ev.label, ev.accent, c.title);
      }
    },
    [active?.type, appendState]
  );

  const openQrModal = (kind: 'business' | 'paychat') => {
    setQrModalKind(kind);
    setShowQrModal(true);
  };

  const completeQrJoin = useCallback(
    (kind: 'business' | 'paychat', contactId: string) => {
      refreshJoined();
      if (kind === 'business') {
        setSection('home');
        setHomeTab('business');
        setHomeActiveId(contactId);
        joinContactViaQr('business', contactId);
      } else {
        setSection('paychat');
        paychatSubTouched.current = true;
        setPaychatSub('outgoing');
        setPaychatActiveId(contactId);
        joinContactViaQr('paychat', contactId);
      }
      setBusinessView('chat');
    },
    [refreshJoined]
  );

  const handleQrJoin = (contactId: string) => {
    completeQrJoin(qrModalKind, contactId);
  };

  useEffect(() => {
    if (!user || !token) return;

    const routed = consumeQrJoinResult();
    if (routed) {
      completeQrJoin(routed.kind, routed.contactId);
      return;
    }

    const pending = consumePendingQrJoin();
    if (!pending) return;

    void executeQrJoin({
      kind: pending.kind,
      raw: pending.code,
      token,
      live: isChatLive(),
    })
      .then((entry) => completeQrJoin(pending.kind, entry.contactId))
      .catch(() => {});
  }, [user, token, completeQrJoin]);

  const selectTab = (next: ChatTab) => {
    if (section === 'paychat') return;
    setHomeTab(next);
    setBusinessView('chat');
    const first = getContactsForTab(next)[0];
    if (first) setHomeActiveId(first.id);
  };

  const handleNavigate = useCallback(
    (next: AppSection, opts?: ShellNavOptions) => {
      if (section === 'explore' && next !== 'explore') setExploreScreen('list');
      setSection(next);
      setShowQrModal(false);
      if (opts?.shopMode) setShopMode(opts.shopMode);
      if (next === 'explore') setExploreScreen(opts?.exploreScreen ?? 'list');
      if (next === 'paychat') {
        setBusinessView('chat');
        const all = getContactsForTab('paychat');
        const inc = all.filter((c) => paychatDir(c) === 'incoming').length;
        const out = all.filter((c) => paychatDir(c) === 'outgoing').length;
        if (!paychatSubTouched.current) {
          setPaychatSub(inc > out ? 'incoming' : 'outgoing');
        }
        if (opts?.contactId) {
          setPaychatActiveId(opts.contactId);
        } else {
          const sub = paychatSubTouched.current ? paychatSub : inc > out ? 'incoming' : 'outgoing';
          const subList = all.filter((c) => paychatDir(c) === sub);
          const stillValid = subList.some((c) => c.id === paychatActiveId);
          if (!stillValid && subList[0]) setPaychatActiveId(subList[0].id);
        }
      } else if (next === 'home') {
        if (opts?.tab) setHomeTab(opts.tab);
        if (opts?.contactId) setHomeActiveId(opts.contactId);
        else {
          const homeList = getContactsForTab(homeTab);
          const stillValid = homeList.some((c) => c.id === homeActiveId);
          if (!stillValid && homeList[0]) setHomeActiveId(homeList[0].id);
        }
        setBusinessView('chat');
      } else if (opts?.tab && opts.tab !== 'paychat') {
        setHomeTab(opts.tab);
      }
    },
    [section, homeTab, homeActiveId, paychatActiveId, paychatSub, getContactsForTab]
  );

  const homePanelActive =
    section === 'home' &&
    (!!homeMainOverlay || (!!active?.isGroup && groupEditMode));

  useEffect(() => {
    if (!isChatSection) setMobileChatFocused(false);
  }, [isChatSection]);

  const selectChat = (id: string) => {
    setActiveForSection(id);
    setBusinessView('chat');
    setCallError(null);
    setHomeMainOverlay(null);
    setGroupEditMode(false);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setMobileChatFocused(true);
    }
  };

  const openGroupEdit = useCallback(
    (contactId?: string) => {
      const id = contactId ?? active?.id;
      if (!id) return;
      const picked =
        resolveContact(id) ?? resolveSavedOrDemo(id) ?? DEMO_CONTACTS[id];
      if (!picked?.isGroup || !picked.groupId) return;
      setActiveForSection(id);
      setBusinessView('chat');
      setHomeMainOverlay(null);
      setGroupEditMode(true);
    },
    [active?.id, resolveContact, resolveSavedOrDemo, setActiveForSection]
  );

  const activeGroupAvatars = useMemo(() => {
    if (!active?.isGroup || !active.groupId) return [];
    return groupAvatarUrlsFor(user?.email ?? 'guest', active.groupId);
  }, [active?.isGroup, active?.groupId, user?.email, groupEditMode]);

  const activeGroupMemberCount = useMemo(() => {
    if (!active?.isGroup || !active.groupId) return 0;
    return loadGroupMemberIds(user?.email ?? 'guest', active.groupId).length;
  }, [active?.isGroup, active?.groupId, user?.email, groupEditMode]);

  const startCall = useCallback(
    async (mode: CallMode, contactOverride?: Contact) => {
      const target = contactOverride ?? active;
      if (!token || !userId || !target) return;
      const peer = resolvePeerUserId(target) ?? peerUserIdForContact(target.id);
      if (!peer) {
        setCallError('No peer user id configured for this contact.');
        return;
      }
      setCallError(null);
      callContactIdRef.current = target.id;
      const chatType = target.type === 'business' ? 'business' : 'personal';
      await agora.joinCall({
        token,
        userId,
        peerUserId: peer,
        peerName: target.name,
        mode,
        chatType,
      });
    },
    [active, agora, token, userId, resolvePeerUserId]
  );

  const requestVideoCall = useCallback(
    (contact?: Contact) => {
      const target = contact ?? active;
      if (!target) return;
      if (contact) {
        setActiveForSection(contact.id);
        setBusinessView('chat');
      }
      setVideoCallCheckout({ contactId: target.id, name: target.name });
    },
    [active, setActiveForSection]
  );

  const confirmVideoCall = useCallback(async () => {
    if (!videoCallCheckout) return;
    const contact =
      resolveContact(videoCallCheckout.contactId) ?? DEMO_CONTACTS[videoCallCheckout.contactId];
    setVideoCallCheckout(null);
    if (contact) await startCall('video', contact);
  }, [videoCallCheckout, resolveContact, startCall]);

  const startCallFromSidebar = useCallback(
    (contactId: string, mode: CallMode) => {
      const contact =
        resolveContact(contactId) ?? resolveSavedOrDemo(contactId) ?? DEMO_CONTACTS[contactId];
      if (!contact) return;
      setHomeMainOverlay(null);
      setActiveForSection(contactId);
      setBusinessView('chat');
      if (mode === 'video') requestVideoCall(contact);
      else void startCall('voice', contact);
    },
    [resolveContact, setActiveForSection, requestVideoCall, startCall]
  );

  const handleStartPersonalChat = useCallback(
    (contact: Contact) => {
      setHomeTab('personal');
      setHomeActiveId(contact.id);
      setBusinessView('chat');
      setStartedPersonalTick((n) => n + 1);
      setHomeMainOverlay(null);
    },
    []
  );

  const openHomeOverlay = useCallback((overlay: HomeMainOverlay) => {
    setHomeMainOverlay(overlay);
  }, []);

  const handleHangUp = useCallback(async () => {
    if (endingCallRef.current) return;
    endingCallRef.current = true;

    const call = agora.activeCall;
    const started = callLiveStartedAt.current;
    const email = user?.email ?? 'guest';
    const contactId = callContactIdRef.current ?? active?.id;

    if (call && started && contactId) {
      const durationSec = Math.max(0, Math.floor((Date.now() - started) / 1000));
      const status = agora.status === 'error' ? 'failed' : durationSec > 0 ? 'completed' : 'missed';
      const entry: CallHistoryEntry = {
        id: `${Date.now()}-${call.mode}`,
        contactId,
        contactName: call.peerName,
        mode: call.mode,
        direction: 'outgoing',
        durationSec,
        costUsd: call.mode === 'video' ? videoCallCost(durationSec) : undefined,
        startedAt: new Date(started).toISOString(),
        status,
      };
      setCallHistory(appendCallHistory(email, entry));
    }

    callLiveStartedAt.current = null;
    callContactIdRef.current = null;
    await agora.hangUp(token);
    setCallError(null);
    endingCallRef.current = false;
  }, [agora, token, active?.id, user?.email]);

  const handleCreate = async (data: {
    title: string;
    scopeText: string;
    priceAmount?: number;
    deadlineAt?: string;
    settlementMode: import('@/lib/types/contract').SettlementMode;
  }) => {
    if (!token || !userId || !bizConv) throw new Error('Not authenticated');
    await createBusinessContract(token, {
      conversationId: bizConv.conversationId,
      createdByUserId: userId,
      counterpartyUserId: bizConv.counterpartyUserId,
      ...data,
    });
    appendState('⚡ Offer sent', '#EF9F27', data.title);
    await loadContracts();
  };

  const runAction = async (c: BusinessContract, action: ContractActionType) => {
    if (!token || !userId || !bizConv) return;
    setActingId(contractId(c));
    try {
      await runContractAction(token, contractId(c), action, userId);
      const updated = await loadContractsByConversation(token, bizConv.conversationId);
      setContracts(updated);
      const match = updated.find((x) => contractId(x) === contractId(c));
      if (match) emitContractState(match);
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActingId(null);
    }
  };

  const handleAction = async (c: BusinessContract, action: ContractActionType) => {
    if (action === 'INITIATE_ESCROW_FUNDING' && c.settlementMode === 'SQUARE') {
      setSquareContract(c);
      return;
    }
    await runAction(c, action);
  };

  const confirmSquarePayment = async () => {
    if (!squareContract || !token || !userId) return;
    const c = squareContract;
    setSquareContract(null);
    setActingId(contractId(c));
    try {
      await runContractAction(token, contractId(c), 'INITIATE_ESCROW_FUNDING', userId);
      await runContractAction(token, contractId(c), 'MARK_ESCROW_FUNDED', userId);
      getChatSession().appendSystemText(
        active.id,
        '✔ Payment confirmed via Square. Starting work tomorrow.'
      );
      await loadContracts();
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setActingId(null);
    }
  };

  const confirmPaychatPayment = () => {
    if (!paychatCheckout) return;
    const { contactId } = paychatCheckout;
    setPaychatCheckout(null);
    setUnlockedPaychat((u) => ({ ...u, [contactId]: true }));
    joinContactViaQr('paychat', contactId);
    refreshJoined();
    getChatSession().appendSystemText(
      contactId,
      'Hi! Thanks for unlocking PayChat. Happy to connect.'
    );
    setActiveForSection(contactId);
  };

  const handlePaychatPaymentSuccess = (method: 'square' | 'vault' = 'square') => {
    if (!paychatCheckout) return;
    const { contactId } = paychatCheckout;
    setPaychatCheckout(null);
    setUnlockedPaychat((u) => ({ ...u, [contactId]: true }));
    joinContactViaQr('paychat', contactId);
    refreshJoined();
    getChatSession().appendSystemText(
      contactId,
      method === 'vault'
        ? 'Vault payment sent on-chain. PayChat unlocked.'
        : 'Payment confirmed via Square. PayChat unlocked.'
    );
    setActiveForSection(contactId);
    setMobileChatFocused(true);
  };

  const handleSwapInitiate = () => {
    appendState('⚡ Converting to Bitcoin — preparing…', '#F7931A', primaryContract?.title);
    setBusinessView('chat');
  };

  const scrollToContracts = () => {
    contractAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const showBusinessContractsError =
    isContractsLive() &&
    isChatSection &&
    effectiveTab === 'business' &&
    active?.type === 'business' &&
    !!contractsError;
  const showContactsWarning = isChatSection && !!contactsError;
  const showChatWarning = isChatSection && !!chatError;
  const showStatusBar =
    authLoading || authError || showBusinessContractsError || showContactsWarning || showChatWarning;

  const chatFallback =
    isChatSection && !active ? (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-[11px] text-[var(--ps-muted)]">
        Loading chats…
      </div>
    ) : null;

  return (
    <ShellNavProvider section={section} shopMode={shopMode} onNavigate={handleNavigate}>
    <ShellChrome>
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden border-0 bg-[var(--ps-bg)]/95 md:h-[min(780px,calc(100vh-1.5rem))] md:rounded-2xl md:border md:border-[var(--ps-brd)] md:shadow-[0_24px_80px_rgba(0,0,0,0.55)] md:backdrop-blur-sm">
      {showStatusBar && (
        <div className="shrink-0 border-b border-[var(--ps-brd)] bg-[var(--ps-card2)] px-3 py-1.5 text-[10px]">
          {authLoading && <span className="text-[var(--ps-muted)]">Connecting…</span>}
          {authError && <span className="text-[var(--ps-red)]">Auth: {authError}</span>}
          {showBusinessContractsError && !authError && (
            <span className="text-[var(--ps-amber)]">
              Contracts unavailable — start gateway for live data. Demo chat still works.
            </span>
          )}
          {showContactsWarning && !authError && (
            <span className="text-[var(--ps-amber)]">Contacts: {contactsError}</span>
          )}
          {showChatWarning && !authError && (
            <span className="text-[var(--ps-amber)]">Chat: {chatError}</span>
          )}
        </div>
      )}

      <header className="flex shrink-0 items-center justify-between border-b border-[var(--ps-brd2)]/40 bg-[var(--ps-surf)] px-3 py-2.5 md:px-4 md:py-3">
        <div className="text-lg font-semibold tracking-tight text-[var(--ps-white)] md:text-[22px]">
          {SECTION_TITLES[section]}
        </div>
        <div className="flex items-center gap-2">
          <span className="truncate text-[10px] text-[var(--ps-muted)]">
            {displayName(user)}
            {user?.mode === 'dev' ? ' · demo' : user?.mode === 'sso' ? ' · live' : ''}
          </span>
          {!isChatSection && (
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-md border border-[var(--ps-brd)] px-2 py-0.5 text-[9px] text-[var(--ps-dim)] hover:text-[var(--ps-white)]"
            >
              Out
            </button>
          )}
        </div>
      </header>

      {isChatSection && active ? (
      <div className="app-shell flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={`flex shrink-0 flex-col border-r border-[var(--ps-brd)] bg-[var(--ps-surf)] md:w-[240px] ${
            mobileChatFocused ? 'max-md:hidden' : 'w-full max-md:flex-1'
          }`}
        >
          <div className="border-b border-[var(--ps-brd)] p-2.5">
            <div className="mb-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => logout()}
                className="rounded-md border border-[var(--ps-brd)] px-2 py-0.5 text-[9px] text-[var(--ps-dim)] hover:text-[var(--ps-white)]"
              >
                Out
              </button>
              <div className="ml-auto flex gap-1">
                {section === 'home' && homeTab === 'business' && (
                  <button
                    type="button"
                    title="Scan business card QR — adds to Business contacts"
                    onClick={() => openQrModal('business')}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--ps-pink)]/40 bg-[var(--ps-card)]"
                  >
                    <QrAddIcon size={22} />
                  </button>
                )}
                {section === 'paychat' && (
                  <button
                    type="button"
                    title="Scan PayChat QR — adds to You pay"
                    onClick={() => openQrModal('paychat')}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--ps-pink)]/40 bg-[var(--ps-card)] text-[11px] text-[var(--ps-pink)]"
                  >
                    ▦
                  </button>
                )}
                {active.type === 'business' && bizConv && (
                  <button
                    type="button"
                    title="New contract"
                    onClick={() => setShowCreate(true)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)] text-[var(--ps-pink)]"
                  >
                    ⚡
                  </button>
                )}
              </div>
            </div>
            {section === 'home' && (
              <button
                type="button"
                onClick={() => setHomeMainOverlay('start-chat')}
                className="mb-2 flex w-full items-center justify-between rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)] px-2.5 py-1.5 text-left transition-colors hover:border-[var(--ps-cyan)]/40"
              >
                <span className="text-[10px] font-medium text-[var(--ps-white)]">Start a chat</span>
                <span className="text-[9px] text-[var(--ps-cyan)]">›</span>
              </button>
            )}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-[var(--ps-brd)] bg-[var(--ps-card)] px-2 py-1 text-[11px] text-[var(--ps-white)] outline-none placeholder:text-[var(--ps-dim)]"
              placeholder="Search chats..."
            />
          </div>

          {section === 'home' && (
            <HomeSidebarActions
              incomingRequestCount={incomingRequestCount}
              onOpen={openHomeOverlay}
            />
          )}

          <div className="w-full min-w-0 border-b border-[var(--ps-brd)]">
            {section === 'paychat' ? (
              <PayChatDirectionTabs
                active={paychatSub}
                incomingCount={paychatCounts.incoming}
                outgoingCount={paychatCounts.outgoing}
                onChange={selectPaychatSub}
                dialStep={paychatSettings.step}
                dialAccepting={paychatSettings.accepting}
                onOpenDial={() => setShowPaychatDial(true)}
              />
            ) : (
              <div className="px-2 pb-2 pt-1">
                <div className="ps-chat-tab-halves grid w-full grid-cols-2 overflow-hidden rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)]">
                  {chatTabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectTab(t.id)}
                      className={`ps-chat-tab-cell border-b-2 text-[10px] font-medium transition-colors ${
                        effectiveTab === t.id
                          ? 'border-[var(--ps-pink)] text-[var(--ps-pink)]'
                          : 'border-transparent text-[var(--ps-dim)] hover:text-[var(--ps-muted)]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={`ps-scroll flex-1 overflow-y-auto ${section === 'paychat' ? 'py-0.5' : 'py-2'}`}>
            {section === 'paychat' && paychatSub === 'incoming' && (
              <div className="px-2 pb-0.5">
                <PayChatReceiveCard
                  name={displayName(user)}
                  inviteCode={paychatInviteCodeForUser(user)}
                  dialStep={paychatSettings.step}
                  accepting={paychatSettings.accepting}
                  compact
                  collapsible
                />
              </div>
            )}
            {list.length === 0 ? (
              <p className="p-4 text-center text-[10px] text-[var(--ps-dim)]">
                No chats in this tab
              </p>
            ) : (
              list.map((c) => (
                <ContactRow
                  key={c.id}
                  contact={c}
                  active={c.id === activeId}
                  unlockedPaychat={unlockedPaychat}
                  onSelect={() => selectChat(c.id)}
                  onViewBusinessProfile={openBusinessProfile}
                  businessRing={
                    effectiveTab === 'business' ? businessAvatarRings[c.id] : undefined
                  }
                  groupAvatarUrls={
                    c.isGroup && c.groupId
                      ? groupAvatarUrlsFor(user?.email ?? 'guest', c.groupId)
                      : undefined
                  }
                  onOpenGroupEdit={
                    c.isGroup ? () => openGroupEdit(c.id) : undefined
                  }
                />
              ))
            )}
          </div>
        </aside>

        <main
          className={`relative flex min-w-0 flex-1 flex-col ${
            mobileChatFocused ? 'max-md:flex' : 'max-md:hidden md:flex'
          }`}
        >
          {homePanelActive ? (
            <>
              {homeMainOverlay === 'find' && (
                <FindPeopleOverlay
                  user={user}
                  displayName={displayName(user)}
                  requests={businessRequests}
                  onClose={() => setHomeMainOverlay(null)}
                  onRefresh={() =>
                    setBusinessRequests(loadBusinessRequests(user?.email ?? 'guest'))
                  }
                  onRequestsChange={setBusinessRequests}
                  onOpenPaychat={() => {
                    setHomeMainOverlay(null);
                    handleNavigate('paychat');
                  }}
                  onVisitProfile={(contactId: string) => {
                    openBusinessProfile(contactId);
                  }}
                />
              )}
              {homeMainOverlay === 'calls' && (
                <CallsContactsOverlay
                  contacts={connectedContacts}
                  history={callHistory}
                  activeContactId={activeId}
                  onClose={() => setHomeMainOverlay(null)}
                  onSelectContact={selectChat}
                  onStartCall={startCallFromSidebar}
                />
              )}
              {homeMainOverlay === 'start-chat' && (
                <StartChatOverlay
                  user={user}
                  activePersonalIds={activePersonalIds}
                  startedPersonalIds={loadStartedPersonalIds(user?.email ?? 'guest')}
                  displayName={displayName(user)}
                  onClose={() => setHomeMainOverlay(null)}
                  onStartPersonalChat={handleStartPersonalChat}
                  onRequestsChange={setBusinessRequests}
                />
              )}
              {!homeMainOverlay && active?.isGroup && active.groupId && groupEditMode && (
                <EditTeamsOverlay
                  user={user}
                  initialGroupId={active.groupId}
                  onBack={() => setGroupEditMode(false)}
                  onVisitProfile={openBusinessProfile}
                />
              )}
            </>
          ) : (
            <>
          {active.type === 'business' && !active.isGroup && (
            <BusinessViewTabs active={businessView} onChange={setBusinessView} />
          )}

          <header className="flex shrink-0 items-center gap-2 border-b border-[var(--ps-brd)] bg-[var(--ps-surf)] px-2 py-2 md:px-3">
            <button
              type="button"
              aria-label="Back to chats"
              onClick={() => setMobileChatFocused(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--ps-brd)] text-sm text-[var(--ps-muted)] md:hidden"
            >
              ←
            </button>
            {active.isGroup && activeGroupAvatars.length > 0 ? (
              <GroupAvatar
                urls={activeGroupAvatars}
                size={28}
                onClick={() => openGroupEdit()}
              />
            ) : (
              <Avatar
                contact={active}
                size={28}
                clickable={active.type === 'business'}
                onClick={
                  active.type === 'business'
                    ? () => openBusinessProfile(active.id)
                    : undefined
                }
              />
            )}
            <div>
              <div className="text-xs font-medium text-[var(--ps-white)]">{active.name}</div>
              <div className="text-[9px] text-[var(--ps-muted)]">
                {active.isGroup
                  ? `Group · ${activeGroupMemberCount} members`
                  : active.type === 'business' && bizConv
                  ? `Business · ${bizConv.conversationId}`
                  : active.type === 'paychat'
                    ? paychatDir(active) === 'incoming'
                      ? 'Pays you'
                      : paychatUnlocked
                        ? 'You pay · unlocked'
                        : 'You pay · locked'
                    : 'Online'}
              </div>
            </div>
            <div className="ml-auto flex gap-1">
              {!active.isGroup &&
                (!paychatUnlocked && active.type === 'paychat' ? null : (
                <>
                  <CallHeaderAction
                    mode="voice"
                    contactId={active.id}
                    contactName={active.name}
                    history={callHistory}
                    disabled={agora.status === 'connecting' || !!agora.activeCall}
                    onStart={() => void startCall('voice')}
                  />
                  <CallHeaderAction
                    mode="video"
                    contactId={active.id}
                    contactName={active.name}
                    history={callHistory}
                    disabled={agora.status === 'connecting' || !!agora.activeCall}
                    onStart={() => requestVideoCall()}
                    videoRateLabel={`$${VIDEO_CALL_RATE_PER_MIN_USD.toFixed(2)}/min via Square`}
                  />
                </>
              ))}
            </div>
          </header>

          {(callError || agora.error) && !agora.activeCall && agora.status !== 'connecting' && (
            <div className="border-b border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] text-red-300">
              {callError || agora.error}
            </div>
          )}

          {primaryContract && active.type === 'business' && !active.isGroup && businessView === 'chat' && (
            <ActiveContractBanner contract={primaryContract} onScrollToContract={scrollToContracts} />
          )}

          {section === 'paychat' && paychatSub === 'incoming' && !paychatSettings.accepting && (
            <div className="border-b border-[var(--ps-amber)]/30 bg-[var(--ps-amber)]/10 px-3 py-1.5 text-[9px] text-[var(--ps-amber)]">
              Incoming PayChats OFF — tap the dial to turn ON (
              {formatPaychatPrice(paychatPriceForStep(paychatSettings.step))}/msg for all).
            </div>
          )}

          {active.type === 'paychat' && paychatDir(active) === 'outgoing' && !paychatUnlocked ? (
            <PayChatGate
              name={active.name}
              askUsd={activePaychatAskUsd}
              onUnlock={() => {
                const peerId = resolvePeerUserId(active);
                void resolveRecipientChiaAddress(active).then((recipientChiaAddress) => {
                  setPaychatCheckout({
                    contactId: active.id,
                    name: active.name,
                    amountUsd: activePaychatAskUsd,
                    toUserId: peerId ?? '',
                    recipientChiaAddress,
                  });
                });
              }}
            />
          ) : active.type === 'business' && !active.isGroup && businessView === 'swap' ? (
            <BtcSwapView onBack={() => setBusinessView('chat')} onInitiate={handleSwapInitiate} />
          ) : (
            <>
              <MessageThread messages={messages}>
                {chatLoading && chatLive && (
                  <p className="text-center text-[10px] text-[var(--ps-dim)]">Loading messages…</p>
                )}
                {active.type === 'business' && !active.isGroup && contractsLoading && contracts.length === 0 && (
                  <p className="text-center text-[10px] text-[var(--ps-dim)]">Loading contracts…</p>
                )}
                <div ref={contractAnchorRef}>
                  {active.type === 'business' && !active.isGroup &&
                    contracts.map((c) => (
                      <ContractCard
                        key={contractId(c)}
                        contract={c}
                        acting={actingId === contractId(c)}
                        onAction={(action) => handleAction(c, action)}
                        onOpenSwap={() => setBusinessView('swap')}
                      />
                    ))}
                </div>
                {active.type === 'business' && !active.isGroup && !contractsLoading && contracts.length === 0 && (
                  <p className="text-center text-[10px] text-[var(--ps-dim)]">
                    No contracts yet — tap ⚡ to create one
                  </p>
                )}
              </MessageThread>

              {active.type === 'business' && !active.isGroup ? (
                <>
                  <ExecBar contractCount={contracts.length} onOpenContracts={() => setShowCreate(true)} />
                  <ChatInput
                    placeholder="Write message..."
                    showMic
                    onSend={(t) => void send(t)}
                    onAttach={(f) => void sendAttachment(f)}
                    uploading={uploading}
                  />
                </>
              ) : active.isGroup ? (
                <ChatInput
                  placeholder="Message group..."
                  showMic
                  onSend={(t) => void send(t)}
                  onAttach={(f) => void sendAttachment(f)}
                  uploading={uploading}
                />
              ) : active.type === 'paychat' && paychatDir(active) === 'incoming' ? (
                <ChatInput
                  placeholder="Reply to payer…"
                  showMic
                  onSend={(t) => void send(t)}
                  onAttach={(f) => void sendAttachment(f)}
                  uploading={uploading}
                />
              ) : (
                <ChatInput
                  placeholder="Message..."
                  showMic
                  onSend={(t) => void send(t)}
                  onAttach={(f) => void sendAttachment(f)}
                  uploading={uploading}
                />
              )}
            </>
          )}

            </>
          )}

          {bizConv && (
            <CreateContractModal
              open={showCreate}
              conversationId={bizConv.conversationId}
              counterpartyUserId={bizConv.counterpartyUserId}
              onClose={() => setShowCreate(false)}
              onSubmit={handleCreate}
            />
          )}

          {squareContract && (
            <SquareCheckoutModal
              mode="contract"
              open
              contract={squareContract}
              onClose={() => setSquareContract(null)}
              onConfirm={confirmSquarePayment}
            />
          )}

          {paychatCheckout &&
            (chatLive && token && userId && paychatCheckout.toUserId ? (
              <PayChatCheckoutModal
                open
                name={paychatCheckout.name}
                amountUsd={paychatCheckout.amountUsd}
                token={token}
                fromUserId={userId}
                toUserId={paychatCheckout.toUserId}
                userEmail={user?.email ?? ''}
                recipientChiaAddress={paychatCheckout.recipientChiaAddress}
                walletLive={process.env.NEXT_PUBLIC_WALLET_LIVE === 'true'}
                onClose={() => setPaychatCheckout(null)}
                onSuccess={handlePaychatPaymentSuccess}
              />
            ) : (
              <SquareCheckoutModal
                mode="paychat"
                open
                name={paychatCheckout.name}
                amountUsd={paychatCheckout.amountUsd}
                onClose={() => setPaychatCheckout(null)}
                onConfirm={confirmPaychatPayment}
              />
            ))}

          {videoCallCheckout && (
            <SquareCheckoutModal
              mode="video-call"
              open
              name={videoCallCheckout.name}
              onClose={() => setVideoCallCheckout(null)}
              onConfirm={confirmVideoCall}
            />
          )}

          <QrJoinModal
            kind={qrModalKind}
            open={showQrModal && isChatSection}
            token={token}
            onClose={() => setShowQrModal(false)}
            onJoin={handleQrJoin}
          />

          {(agora.activeCall || agora.pendingCall) && (
            <CallOverlay
              call={
                agora.activeCall ?? {
                  channel: 'connecting…',
                  ...agora.pendingCall!,
                }
              }
              status={agora.status === 'idle' ? 'connecting' : agora.status}
              error={agora.error}
              muted={agora.muted}
              remoteUsers={agora.remoteUsers}
              remoteVideoRef={agora.remoteVideoRef}
              localVideoRef={agora.localVideoRefEl}
              onHangUp={handleHangUp}
              onToggleMute={agora.toggleMute}
            />
          )}
        </main>

        {!(section === 'home' && homePanelActive) && (
        <aside className="ps-scroll hidden w-[210px] shrink-0 flex-col overflow-y-auto border-l border-[var(--ps-brd)] bg-[var(--ps-surf)] md:flex">
          <ContactDetailPanel
            contact={active}
            contracts={contracts}
            paychatLocked={
              active.type === 'paychat' &&
              paychatDir(active) === 'outgoing' &&
              !paychatUnlocked
            }
            onViewBusinessProfile={
              active.type === 'business' ? () => openBusinessProfile(active.id) : undefined
            }
          />
          <WalletPanel />
        </aside>
        )}
      </div>
      ) : chatFallback ? (
        chatFallback
      ) : section === 'shop' ? (
        <ShopView />
      ) : section === 'share' ? (
        <SectionPanel width="narrow">
          <ShareView user={user} />
        </SectionPanel>
      ) : section === 'explore' ? (
        <SectionPanel width="wide">
          <ExploreView screen={exploreScreen} onScreenChange={setExploreScreen} />
        </SectionPanel>
      ) : section === 'me' ? (
        <SectionPanel width="default">
          <ProfileView user={user} />
        </SectionPanel>
      ) : null}

      <BottomNav section={section} onChange={handleNavigate} user={user} />

      <BusinessProfileModal
        profile={businessProfile}
        onClose={() => setBusinessProfileId(null)}
        viewerEmail={user?.email ?? 'guest'}
        onShareToChat={
          isChatSection && active
            ? (card: BusinessCardSnapshot) => {
                getChatSession().sendBusinessCard(active.id, card);
                setBusinessProfileId(null);
              }
            : undefined
        }
      />

      <PayChatDialOverlay
        open={showPaychatDial}
        step={paychatSettings.step}
        accepting={paychatSettings.accepting}
        onStepChange={(s) => updatePaychatSettings({ step: s })}
        onAcceptingChange={(a) => updatePaychatSettings({ accepting: a })}
        onClose={() => setShowPaychatDial(false)}
      />
    </div>
    </ShellChrome>
    </ShellNavProvider>
  );
}
