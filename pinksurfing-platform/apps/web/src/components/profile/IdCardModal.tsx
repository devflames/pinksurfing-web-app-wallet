'use client';

import type { SessionUser } from '@/lib/types/user';
import { displayName } from '@/lib/auth-storage';
import { QrDisplay } from './QrDisplay';
import { BusinessCardFlipView } from '@/components/cards/BusinessCardFlipView';
import { snapshotFromProfile } from '@/lib/business-card-types';
import { paychatInviteCodeForUser, businessInviteCodeForUser } from '@/lib/qr-invite';
import { loadPayChatSettings } from '@/lib/paychat-settings-storage';
import { businessProfileForUser } from '@/lib/business-profile-data';
import { PayChatReceiveCard } from '@/components/paychat/PayChatReceiveCard';
import { HealthCardsPanel } from './wallet/HealthCardsPanel';
import { ProfessionalLicensesPanel } from './wallet/ProfessionalLicensesPanel';
import { MiscCardsPanel } from './wallet/MiscCardsPanel';

export type IdCardKind =
  | 'business'
  | 'paychat'
  | 'insurance'
  | 'driver'
  | 'professional'
  | 'misc';

type Props = {
  kind: IdCardKind | null;
  onClose: () => void;
  user: SessionUser | null;
  profileMode: 'personal' | 'business';
  businessName: string;
  position: string;
  industry: string;
  location: string;
};

const TITLES: Record<IdCardKind, string> = {
  business: 'Business Card',
  paychat: 'My PayChat Card',
  insurance: 'Health & Insurance Cards',
  driver: 'Driver Licence',
  professional: 'Professional Licenses',
  misc: 'Miscellaneous Cards',
};

function BusinessCardBody({
  user,
  location,
  profileMode,
  businessName,
}: {
  user: SessionUser | null;
  location: string;
  profileMode: 'personal' | 'business';
  businessName: string;
}) {
  const profile = businessProfileForUser(user);
  const displayTitle = profileMode === 'business' ? businessName : profile.name;
  const snapshot = snapshotFromProfile({
    ...profile,
    businessName: displayTitle,
    inviteCode: businessInviteCodeForUser(user),
    address: location.includes(',') && location.length > 12 ? location : profile.address,
    email: user?.email ?? profile.email,
  });

  return (
    <div className="space-y-2">
      <BusinessCardFlipView card={snapshot} variant="owner" user={user} />
      <p className="text-center text-[9px] text-[var(--ps-dim)]">
        ⇄ Flip for app download QR · Share sends front &amp; back together
      </p>
    </div>
  );
}

function PayChatCardBody({
  user,
  name,
  email,
}: {
  user: SessionUser | null;
  name: string;
  email: string;
}) {
  const settings = loadPayChatSettings(email);
  return (
    <div className="space-y-2">
      <PayChatReceiveCard
        name={name}
        inviteCode={paychatInviteCodeForUser(user)}
        dialStep={settings.step}
        accepting={settings.accepting}
      />
      <p className="text-center text-[9px] leading-relaxed text-[var(--ps-dim)]">
        Share this QR so others add you to their You pay list. Scan someone else&apos;s PayChat QR
        from the PayChat tab to add them to your You pay list.
      </p>
    </div>
  );
}

function DriverLicenceBody({ name, location }: { name: string; location: string }) {
  const licenceNo = 'DL-PS-7849201';
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--ps-brd)] bg-black">
      <div className="border-b border-[var(--ps-brd)] bg-[var(--ps-surf)] px-3 py-1.5 text-[9px] uppercase tracking-widest text-[var(--ps-cyan)]">
        Driver Licence · Demo
      </div>
      <div className="flex gap-3 p-4">
        <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-md border border-[var(--ps-brd)] bg-[var(--ps-card2)] text-2xl text-[var(--ps-dim)]">
          👤
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-[12px] font-semibold text-[var(--ps-white)]">{name}</div>
          <div className="text-[10px] text-[var(--ps-muted)]">{location}</div>
          <div className="font-mono text-[10px] text-[var(--ps-cyan)]">{licenceNo}</div>
          <div className="text-[9px] text-[var(--ps-dim)]">Class C · Exp 2028-06</div>
        </div>
        <QrDisplay value={`DL:${licenceNo}`} size={72} />
      </div>
    </div>
  );
}

export function IdCardModal({
  kind,
  onClose,
  user,
  profileMode,
  businessName,
  position,
  industry,
  location,
}: Props) {
  if (!kind) return null;

  const name = displayName(user);
  const email = user?.email ?? '';
  const shareLink = `https://pinksurfing.com`;

  const copyLink = () => {
    const payload =
      kind === 'paychat'
        ? paychatInviteCodeForUser(user)
        : kind === 'business'
          ? businessInviteCodeForUser(user)
          : shareLink;
    void navigator.clipboard?.writeText(payload);
  };

  const showCopyLink = kind === 'business' || kind === 'paychat';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--ps-brd)] bg-[var(--ps-bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="id-card-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--ps-brd)] bg-[var(--ps-surf)] px-4 py-3">
          <span id="id-card-title" className="text-sm font-semibold text-[var(--ps-white)]">
            {TITLES[kind]}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ps-dim)] hover:bg-[var(--ps-card)] hover:text-[var(--ps-white)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {kind === 'business' && (
            <BusinessCardBody
              user={user}
              location={location}
              profileMode={profileMode}
              businessName={businessName}
            />
          )}
          {kind === 'paychat' && <PayChatCardBody user={user} name={name} email={email} />}
          {kind === 'insurance' && <HealthCardsPanel email={email} />}
          {kind === 'driver' && <DriverLicenceBody name={name} location={location} />}
          {kind === 'professional' && <ProfessionalLicensesPanel email={email} />}
          {kind === 'misc' && <MiscCardsPanel email={email} />}

          <div className={`flex gap-2 ${showCopyLink ? 'mt-4' : 'mt-3'}`}>
            {showCopyLink && (
              <button
                type="button"
                className="flex-1 rounded-xl border border-[var(--ps-brd)] py-2.5 text-[11px] text-[var(--ps-muted)] hover:border-[var(--ps-cyan)]/40 hover:text-[var(--ps-cyan)]"
                onClick={copyLink}
              >
                Copy link
              </button>
            )}
            <button
              type="button"
              className={`rounded-xl bg-[var(--ps-pink)] py-2.5 text-[11px] font-semibold text-[var(--ps-card)] hover:opacity-90 ${showCopyLink ? 'flex-1' : 'w-full'}`}
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const PROFILE_CARD_BUTTONS: { label: string; kind: IdCardKind }[] = [
  { label: 'Business Card', kind: 'business' },
  { label: 'My PayChat Card', kind: 'paychat' },
  { label: 'Health & Insurance', kind: 'insurance' },
  { label: 'Driver Licence', kind: 'driver' },
  { label: 'Professional Licenses', kind: 'professional' },
  { label: 'Miscellaneous Cards', kind: 'misc' },
];
