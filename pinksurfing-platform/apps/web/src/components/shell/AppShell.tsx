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
import { ContractThreadItem } from '@/components/contracts/ContractThreadItem';
import { CreateContractModal } from '@/components/contracts/CreateContractModal';
import { pickActiveContract } from '@/lib/contract-timeline';
import { PayChatGate } from '@/components/paychat/PayChatGate';
import { PayChatReceiveCard } from '@/components/paychat/PayChatReceiveCard';
import { PayChatDialOverlay } from '@/components/paychat/PayChatDialOverlay';
import { PayChatDirectionTabs } from '@/components/paychat/PayChatDirectionTabs';
import { SquareCheckoutModal } from '@/components/paychat/SquareCheckoutModal';
import { PayChatCheckoutModal } from '@/components/paychat/PayChatCheckoutModal';
import { ContractSquareCheckoutModal } from '@/components/contracts/ContractSquareCheckoutModal';
import { useEdgeSwipeOpen } from '@/lib/use-edge-swipe';
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
import { getChatSession } from '@/lib/chat-session';
import {
  createBusinessContract,
  isContractsLive,
  loadContractsByConversation,
  runContractAction,
} from '@/lib/contracts-service';
import { resolveBusinessConversation } from '@/lib/business-conversation';
import {
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
import { BuildTabTitle } from '@/components/shell/BuildTabTitle';
import { useIsMobile } from '@/lib/use-is-mobile';
import { useLiveChat } from '@/lib/use-live-chat';
import { useContacts } from '@/lib/use-contacts';
import {
  addPersonalContactByEmail,
  fetchContactList,
  fetchDiscoverPeople,
  fetchPaychatRoomStatus,
  isChatLive,
} from '@/lib/chat-api';
import { usdToMojosEstimate } from '@/lib/wallet-api';
import { publishStateEvent } from '@/lib/state-message-service';
import { VAULT_STATE_LABELS } from '@/lib/state-message-types';
import { CallOverlay } from '@/components/calls/CallOverlay';
import { CallHeaderAction } from '@/components/calls/CallHeaderAction';
import { CallsContactsOverlay } from '@/components/calls/CallsContactsOverlay';
import { FindPeopleOverlay } from '@/components/contacts/FindPeopleOverlay';
import { EditTeamsOverlay } from '@/components/groups/EditTeamsOverlay';
import { GroupAvatar } from '@/components/groups/GroupAvatar';
import { groupAvatarUrlsFor, loadGroupMemberIds } from '@/lib/group-teams';
import { HomeSidebarActions } from '@/components/contacts/HomeSidebarActions';
import { StartChatOverlay } from '@/components/contacts/StartChatOverlay';
import { BusinessRequestAcceptanceWatcher } from '@/components/contacts/BusinessRequestAcceptanceWatcher';
import { QrAddIcon } from '@/components/icons/QrAddIcon';
import { useContactPreview } from '@/lib/use-chat-session';
import {
  incomingRequests,
  loadBusinessRequests,
  type BusinessContactRequest,
} from '@/lib/business-contact-requests';
import { fetchBusinessRequests, incomingRequestsLive } from '@/lib/business-contact-requests-api';
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
import { AvatarRing } from '@/components/contracts/AvatarRing';
import {
  businessAvatarRing,
  contractsForBusinessContact,
  type BusinessAvatarRing,
} from '@/lib/business-chat-ring';
import { useAgoraCall } from '@/lib/use-agora-call';
import { useIncomingCalls } from '@/lib/use-incoming-calls';
import { IncomingCallModal } from '@/components/calls/IncomingCallModal';


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
  const inner = (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
        clickable && (!businessRing || businessRing === 'none')
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

  const wrapped = (
    <AvatarRing ring={businessRing} size={size}>
      {inner}
    </AvatarRing>
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
        {wrapped}
      </button>
    );
  }

  return wrapped;
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
  const isMobile = useIsMobile();
  const { token, user, userId, loading: authLoading, error: authError, logout } = useAuth();
  const [section, setSection] = useState<AppSection>('home');
  const [homeTab, setHomeTab] = useState<ChatTab>('business');
  const [homeActiveId, setHomeActiveId] = useState('c3');
  const [paychatActiveId, setPaychatActiveId] = useState('c6');
  const {
    loading: contactsLoading,
    error: contactsError,
    liveContactsEmpty,
    reload: reloadContacts,
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
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [unlockedPaychat, setUnlockedPaychat] = useState<Record<string, boolean>>({ c7: true });
  const [squareContract, setSquareContract] = useState<BusinessContract | null>(null);
  const [paychatCheckoutError, setPaychatCheckoutError] = useState<string | null>(null);
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
  const callBusy = agora.status === 'connecting' || agora.status === 'live' || !!agora.pendingCall;
  const { incoming, dismiss: dismissIncoming, clearIncoming } = useIncomingCalls(token, userId, {
    enabled: isChatLive(),
    busy: callBusy,
  });

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
    if (isChatLive()) return [];
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
    if (!isChatLive() || !token) {
      setBusinessRequests(loadBusinessRequests(user?.email ?? 'guest'));
      return;
    }
    const load = () => {
      void fetchBusinessRequests(token)
        .then(setBusinessRequests)
        .catch(() => setBusinessRequests([]));
    };
    load();
    const timer = window.setInterval(load, 20_000);
    return () => window.clearInterval(timer);
  }, [user?.email, token]);

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

  const chatLive = isChatLive();

  const active =
    resolveContact(activeId) ??
    (!chatLive ? resolveSavedOrDemo(activeId) ?? DEMO_CONTACTS[activeId] : undefined) ??
    list[0];

  const activePersonalIds = useMemo(
    () => new Set(getContactsForTab('personal').map((c) => c.id)),
    [getContactsForTab]
  );

  const incomingRequestCount = useMemo(() => {
    if (chatLive && userId) {
      return incomingRequestsLive(businessRequests, userId).length;
    }
    return incomingRequests(user?.email ?? 'guest').length;
  }, [chatLive, userId, user?.email, businessRequests]);
  const peerUserId = active ? resolvePeerUserId(active) : null;
  const bizConv =
    active?.type === 'business' ? resolveBusinessConversation(active, userId) : null;
  const primaryContract = useMemo(() => pickActiveContract(contracts), [contracts]);

  const businessAvatarRings = useMemo(() => {
    if (effectiveTab !== 'business') return {} as Record<string, BusinessAvatarRing>;
    const map: Record<string, BusinessAvatarRing> = {};
    for (const c of getContactsForTab('business')) {
      const contractList =
        active?.type === 'business' && active.id === c.id && contracts.length > 0
          ? contracts
          : contractsForBusinessContact(c.id);
      map[c.id] = businessAvatarRing(contractList);
    }
    return map;
  }, [effectiveTab, getContactsForTab, contracts, active?.id, active?.type]);
  const paychatUnlocked =
    active?.type === 'paychat' &&
    (paychatDir(active) === 'incoming' || active.unlocked || unlockedPaychat[active.id]);

  const activePaychatAskUsd =
    active?.type === 'paychat'
      ? (paychatServerAsk[active.id] ?? active.askUsd ?? 0)
      : 0;

  const {
    messages,
    send,
    sendAttachment,
    appendState,
    loading: chatLoading,
    uploading,
    error: chatError,
    reload: reloadChat,
  } = useLiveChat({
    token,
    userId,
    contact: active ?? list[0] ?? DEMO_CONTACTS.c1,
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

  const loadContracts = useCallback(async (): Promise<BusinessContract[]> => {
    if (!bizConv) {
      setContracts([]);
      return [];
    }
    if (isContractsLive() && !token) {
      setContracts([]);
      return [];
    }
    setContractsLoading(true);
    setContractsError(null);
    try {
      const data = await loadContractsByConversation(token ?? '', bizConv.conversationId);
      setContracts(data);
      return data;
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Failed to load contracts');
      setContracts([]);
      return [];
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

  const openQrModal = (kind: 'business' | 'paychat') => {
    setQrModalKind(kind);
    setShowQrModal(true);
  };

  const completeQrJoin = useCallback(
    (kind: 'business' | 'paychat', contactId: string) => {
      void reloadContacts().then(() => {
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
      });
    },
    [refreshJoined, reloadContacts]
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

  const openMobileContacts = useCallback(() => setMobileChatFocused(false), []);

  const edgeSwipe = useEdgeSwipeOpen(
    openMobileContacts,
    isMobile && isChatSection && mobileChatFocused && !homePanelActive
  );

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

      const isGroup = !!(target.isGroup && target.groupId);
      const peer = isGroup
        ? target.groupId!
        : resolvePeerUserId(target) ?? (!chatLive ? peerUserIdForContact(target.id) : null);

      if (!peer) {
        setCallError(isGroup ? 'Group id missing for this chat.' : 'No peer user id configured for this contact.');
        return;
      }

      setCallError(null);
      callContactIdRef.current = target.id;
      const chatType = target.type === 'business' ? 'business' : 'personal';

      await agora.startOutgoingCall({
        token,
        userId,
        peerUserId: peer,
        peerName: target.name,
        mode,
        chatType,
        isGroup,
        groupId: isGroup ? target.groupId : undefined,
        groupName: isGroup ? target.name : undefined,
      });
    },
    [active, agora, token, userId, resolvePeerUserId]
  );

  const acceptIncoming = useCallback(async () => {
    if (!incoming || !token || !userId) return;
    clearIncoming();
    dismissIncoming(incoming.channel);
    await agora.answerIncomingCall({
      token,
      userId,
      channel: incoming.channel,
      peerUserId: incoming.isGroup ? incoming.groupId ?? incoming.to : incoming.from,
      peerName: incoming.isGroup ? incoming.groupName ?? incoming.callerName : incoming.callerName,
      mode: incoming.mode,
      chatType: incoming.chatType,
      isGroup: incoming.isGroup,
      groupId: incoming.groupId,
      groupName: incoming.groupName,
    });
  }, [agora, clearIncoming, dismissIncoming, incoming, token, userId]);

  const rejectIncoming = useCallback(async () => {
    if (!incoming || !token) return;
    dismissIncoming(incoming.channel);
    await agora.declineIncomingCall(token, incoming.channel, incoming.groupId ?? '0');
    clearIncoming();
  }, [agora, clearIncoming, dismissIncoming, incoming, token]);

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

  const handleAddPersonalLive = useCallback(
    async (addr: string, peerUserId?: string, name?: string) => {
      if (!token) throw new Error('Sign in to add contacts');
      await addPersonalContactByEmail(token, addr);
      const list = await fetchContactList(token);
      let contact =
        peerUserId != null
          ? list.find((c) => c.type === 'personal' && c.userId === peerUserId)
          : undefined;
      if (!contact) {
        const discover = await fetchDiscoverPeople(token);
        const row = discover?.find((d) => d.email?.toLowerCase() === addr.toLowerCase());
        if (row) {
          contact = list.find((c) => c.userId === row.userId);
        }
      }
      await reloadContacts();
      if (contact) {
        handleStartPersonalChat(contact);
        return;
      }
      const fallbackName = name ?? addr.split('@')[0];
      if (peerUserId) {
        handleStartPersonalChat({
          id: `live-${peerUserId}`,
          userId: peerUserId,
          name: fallbackName,
          initials: fallbackName.slice(0, 2).toUpperCase(),
          color: '#FF7AD1',
          bg: '#FF7AD120',
          type: 'personal',
          preview: 'Start a conversation',
          time: '',
        });
        return;
      }
      throw new Error('Contact added — refresh and select them from your personal list.');
    },
    [token, reloadContacts, handleStartPersonalChat]
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
    await loadContracts();
    if (chatLive) void reloadChat();
  };

  const runAction = async (c: BusinessContract, action: ContractActionType) => {
    if (!token || !userId || !bizConv) return;
    setActingId(contractId(c));
    try {
      await runContractAction(token, contractId(c), action, userId);
      const updated = await loadContractsByConversation(token, bizConv.conversationId);
      setContracts(updated);
      if (chatLive) void reloadChat();
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
    // Demo-only fallback when contracts are not live.
    if (!squareContract || !token || !userId) return;
    const c = squareContract;
    setSquareContract(null);
    setActingId(contractId(c));
    try {
      await runContractAction(token, contractId(c), 'INITIATE_ESCROW_FUNDING', userId);
      await runContractAction(token, contractId(c), 'MARK_ESCROW_FUNDED', userId);
      await loadContracts();
      if (chatLive) void reloadChat();
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setActingId(null);
    }
  };

  const handleContractSquareSuccess = async () => {
    if (!squareContract || !token || !bizConv) return;
    const c = squareContract;
    setSquareContract(null);
    setActingId(contractId(c));
    try {
      const updated = await loadContractsByConversation(token, bizConv.conversationId);
      setContracts(updated);
      if (chatLive) void reloadChat();
    } catch (e) {
      setContractsError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setActingId(null);
    }
  };

  const refreshBusinessRequests = useCallback(() => {
    if (isChatLive() && token) {
      void fetchBusinessRequests(token).then(setBusinessRequests).catch(() => {});
      return;
    }
    setBusinessRequests(loadBusinessRequests(user?.email ?? 'guest'));
  }, [token, user?.email]);

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
    const { contactId, toUserId } = paychatCheckout;

    // Vault unlock + state message are posted server-side (paychat/vault-unlock).
    // Square still publishes client-side until webhook posts state events.
    if (method === 'square' && chatLive && token && userId && toUserId) {
      const labels = VAULT_STATE_LABELS.PAYCHAT_SQUARE;
      void publishStateEvent({
        token,
        fromUserId: userId,
        toUserId,
        contactId,
        chatType: 'paychat',
        label: labels.label,
        accent: labels.accent,
        contractTitle: 'PayChat unlock',
        eventType: 'PAYMENT_SQUARE',
        refId: contactId,
      }).then(() => {
        if (active?.id === contactId) void reloadChat();
      });
    } else if (!chatLive) {
      const labels =
        method === 'vault' ? VAULT_STATE_LABELS.PAYCHAT_VAULT : VAULT_STATE_LABELS.PAYCHAT_SQUARE;
      getChatSession().appendStateEvent(
        contactId,
        labels.label,
        labels.accent,
        'PayChat unlock'
      );
    } else if (method === 'vault' && active?.id === contactId) {
      void reloadChat();
    }

    setPaychatCheckout(null);
    setUnlockedPaychat((u) => ({ ...u, [contactId]: true }));
    joinContactViaQr('paychat', contactId);
    refreshJoined();
    if (!chatLive) {
      getChatSession().appendSystemText(
        contactId,
        method === 'vault'
          ? 'Vault payment sent on-chain. PayChat unlocked.'
          : 'Payment confirmed via Square. PayChat unlocked.'
      );
    }
    setActiveForSection(contactId);
    setMobileChatFocused(true);
  };

  const handleSwapInitiate = () => {
    void appendState(
      VAULT_STATE_LABELS.SWAP_INITIATED.label,
      VAULT_STATE_LABELS.SWAP_INITIATED.accent,
      primaryContract?.title,
      {
        eventType: 'VAULT_SWAP',
        refId: primaryContract ? contractId(primaryContract) : undefined,
      }
    );
    setBusinessView('chat');
  };

  const scrollToContracts = () => {
    if (primaryContract) {
      setExpandedContractId(contractId(primaryContract));
    }
    contractAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const showBusinessContractsError =
    isContractsLive() &&
    isChatSection &&
    effectiveTab === 'business' &&
    active?.type === 'business' &&
    !!contractsError;
  const showContactsWarning =
    isChatSection && (!!contactsError || liveContactsEmpty);
  const showChatWarning = isChatSection && !!chatError;
  const showStatusBar =
    authLoading || authError || showBusinessContractsError || showContactsWarning || showChatWarning;

  const emptyHomeFindOpen =
    section === 'home' && !active && homeMainOverlay === 'find';

  const findPeopleOverlay = (
    <FindPeopleOverlay
      user={user}
      token={token}
      userId={userId}
      displayName={displayName(user)}
      requests={businessRequests}
      onClose={() => setHomeMainOverlay(null)}
      onRefresh={refreshBusinessRequests}
      onRequestsChange={setBusinessRequests}
      onOpenPaychat={() => {
        setHomeMainOverlay(null);
        handleNavigate('paychat');
      }}
      onVisitProfile={(contactId: string) => {
        openBusinessProfile(contactId);
      }}
      onContactsRefresh={() => void reloadContacts()}
    />
  );

  const chatFallback =
    isChatSection && !active && !emptyHomeFindOpen ? (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center text-[11px] text-[var(--ps-muted)]">
        {contactsLoading ? (
          <>Loading chats…</>
        ) : (
          <>
            <span className="text-sm font-medium text-[var(--ps-white)]">No chats yet</span>
            <span>Scan a QR code or find people to add your first contact.</span>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {section === 'home' && (
                <>
                  <button
                    type="button"
                    onClick={() => openHomeOverlay('find')}
                    className="rounded-lg border border-[var(--ps-white)]/20 bg-[var(--ps-card)] px-4 py-2 text-[11px] font-medium text-[var(--ps-white)] hover:border-[var(--ps-white)]/40"
                  >
                    Find people
                  </button>
                  <button
                    type="button"
                    onClick={() => openQrModal('business')}
                    className="rounded-lg border border-[var(--ps-pink)]/50 bg-[var(--ps-card)] px-4 py-2 text-[11px] font-medium text-[var(--ps-pink)] hover:border-[var(--ps-pink)]"
                  >
                    Scan business QR
                  </button>
                </>
              )}
              {(section === 'home' || section === 'paychat') && (
                <button
                  type="button"
                  onClick={() => openQrModal('paychat')}
                  className="rounded-lg border border-[var(--ps-cyan)]/50 bg-[var(--ps-card)] px-4 py-2 text-[11px] font-medium text-[var(--ps-cyan)] hover:border-[var(--ps-cyan)]"
                >
                  Scan PayChat QR
                </button>
              )}
            </div>
          </>
        )}
      </div>
    ) : null;

  return (
    <ShellNavProvider section={section} shopMode={shopMode} onNavigate={handleNavigate}>
    <BusinessRequestAcceptanceWatcher
      email={user?.email ?? 'guest'}
      userId={userId}
      requests={businessRequests}
      onRefresh={refreshBusinessRequests}
      onContactsRefresh={() => void reloadContacts()}
      onOpenRequests={() => {
        setHomeMainOverlay('find');
        handleNavigate('home');
      }}
    />
    <ShellChrome>
    <BuildTabTitle sectionLabel={SECTION_TITLES[section]} />
    <div
      className={`ps-shell-frame relative flex w-full flex-col overflow-hidden border-0 bg-[var(--ps-bg)]/95 md:h-[min(780px,calc(100vh-1.5rem))] md:rounded-2xl md:border md:border-[var(--ps-brd)] md:shadow-[0_24px_80px_rgba(0,0,0,0.55)] md:backdrop-blur-sm ${
        isMobile ? 'h-[100dvh] max-h-[100dvh] rounded-none shadow-none' : 'h-[100dvh]'
      }`}
    >
      {showStatusBar && (
        <div className="shrink-0 border-b border-[var(--ps-brd)] bg-[var(--ps-card2)] px-3 py-1.5 text-[10px]">
          {authLoading && <span className="text-[var(--ps-muted)]">Connecting…</span>}
          {authError && <span className="text-[var(--ps-red)]">Auth: {authError}</span>}
          {showBusinessContractsError && !authError && (
            <span className="text-[var(--ps-amber)]">
              Contracts: {contractsError}
              {liveContactsEmpty ? ' — add a real business contact (QR scan), not demo chats.' : ''}
            </span>
          )}
          {showContactsWarning && !authError && (
            <span className="text-[var(--ps-amber)]">
              {contactsError ??
                'No live contacts yet — scan a business or PayChat QR to add real contacts.'}
            </span>
          )}
          {showChatWarning && !authError && (
            <span className="text-[var(--ps-amber)]">Chat: {chatError}</span>
          )}
        </div>
      )}

      <header className="ps-shell-top-header flex shrink-0 items-center justify-between border-b border-[var(--ps-brd2)]/40 bg-[var(--ps-surf)] px-3 py-2.5 md:px-4 md:py-3">
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
          onTouchStart={edgeSwipe.onTouchStart}
          onTouchMove={edgeSwipe.onTouchMove}
          onTouchEnd={edgeSwipe.onTouchEnd}
        >
          {homePanelActive ? (
            <>
              {homeMainOverlay === 'find' && findPeopleOverlay}
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
                  token={token}
                  userId={userId}
                  activePersonalIds={activePersonalIds}
                  startedPersonalIds={loadStartedPersonalIds(user?.email ?? 'guest')}
                  displayName={displayName(user)}
                  requests={businessRequests}
                  onClose={() => setHomeMainOverlay(null)}
                  onStartPersonalChat={handleStartPersonalChat}
                  onRequestsChange={setBusinessRequests}
                  onAddPersonalLive={handleAddPersonalLive}
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
              {(active.isGroup || active.type !== 'paychat' || paychatUnlocked) && (
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
                    onStart={() => (active.isGroup ? void startCall('video') : requestVideoCall())}
                    videoRateLabel={
                      active.isGroup
                        ? 'Group video'
                        : `$${VIDEO_CALL_RATE_PER_MIN_USD.toFixed(2)}/min via Square`
                    }
                  />
                </>
              )}
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
                setPaychatCheckoutError(null);
                const peerId = resolvePeerUserId(active);
                if (chatLive && !peerId) {
                  setPaychatCheckoutError(
                    'Scan their PayChat QR first so we can connect to their account.'
                  );
                  return;
                }
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
            <BtcSwapView
              onBack={() => setBusinessView('chat')}
              onInitiate={handleSwapInitiate}
              vaultUsd={
                primaryContract?.priceAmount != null &&
                primaryContract.settlementMode === 'BTC_SWAP'
                  ? primaryContract.priceAmount
                  : undefined
              }
              xchAmountMojos={
                primaryContract?.priceAmount != null &&
                primaryContract.settlementMode === 'BTC_SWAP'
                  ? String(usdToMojosEstimate(primaryContract.priceAmount))
                  : undefined
              }
            />
          ) : (
            <>
              <MessageThread
                messages={messages}
                variant={active.type === 'business' && !active.isGroup ? 'neu' : 'classic'}
              >
                {chatLoading && chatLive && (
                  <p className="text-center text-[10px] text-[var(--ps-dim)]">Loading messages…</p>
                )}
                {active.type === 'business' && !active.isGroup && contractsLoading && contracts.length === 0 && (
                  <p className="text-center text-[10px] text-[var(--ps-dim)]">Loading contracts…</p>
                )}
                <div ref={contractAnchorRef}>
                  {active.type === 'business' && !active.isGroup &&
                    contracts.map((c) => {
                      const id = contractId(c);
                      return (
                        <ContractThreadItem
                          key={id}
                          contract={c}
                          expanded={expandedContractId === id}
                          acting={actingId === id}
                          onToggle={(toggleId) =>
                            setExpandedContractId((prev) =>
                              prev === toggleId ? null : toggleId
                            )
                          }
                          onAction={(action) => handleAction(c, action)}
                          onOpenSwap={() => setBusinessView('swap')}
                        />
                      );
                    })}
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

          {squareContract &&
            (isContractsLive() && token ? (
              <ContractSquareCheckoutModal
                open
                contract={squareContract}
                token={token}
                onClose={() => setSquareContract(null)}
                onSuccess={() => void handleContractSquareSuccess()}
              />
            ) : (
              <SquareCheckoutModal
                mode="contract"
                open
                contract={squareContract}
                onClose={() => setSquareContract(null)}
                onConfirm={confirmSquarePayment}
              />
            ))}

          {paychatCheckoutError && (
            <div className="border-b border-[var(--ps-pink)]/30 bg-[var(--ps-pink)]/10 px-3 py-2 text-[10px] text-[var(--ps-pink)]">
              {paychatCheckoutError}
            </div>
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
            ) : chatLive ? null : (
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

          {incoming && !callBusy && (
            <IncomingCallModal
              call={incoming}
              onAccept={() => void acceptIncoming()}
              onReject={() => void rejectIncoming()}
            />
          )}
        </main>

        {!(section === 'home' && homePanelActive) && (
        <aside className="ps-scroll hidden w-[210px] shrink-0 flex-col overflow-y-auto border-l border-[var(--ps-brd)] bg-[var(--ps-surf)] md:flex">
          <ContactDetailPanel
            contact={active}
            contracts={contracts}
            activeContractId={expandedContractId}
            onSelectContract={(id) => {
              setExpandedContractId(id);
              contractAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
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
      ) : emptyHomeFindOpen ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{findPeopleOverlay}</div>
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

      {isChatSection && (
        <QrJoinModal
          kind={qrModalKind}
          open={showQrModal}
          token={token}
          onClose={() => setShowQrModal(false)}
          onJoin={handleQrJoin}
        />
      )}

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
