'use client';

import { QrDisplay } from '@/components/profile/QrDisplay';
import { resolveBusinessLogoUrl } from '@/components/profile/ProfileAvatarStack';
import { buildQrPayload } from '@/lib/qr-invite';
import type { BusinessStoreLink } from '@/lib/business-profile-data';
import {
  gmailComposeUrl,
  mapsDirectionsUrl,
  storeMessage,
  telUrl,
} from '@/lib/business-profile-data';
import type { SessionUser } from '@/lib/types/user';

type Props = {
  name: string;
  credentials?: string;
  address: string;
  phone: string;
  email: string;
  inviteCode: string;
  store?: BusinessStoreLink;
  businessLogoUrl?: string;
  user?: SessionUser | null;
  compact?: boolean;
};

const ICON_COL = 'relative z-[1] flex shrink-0 items-center justify-center';

function GoldAction({
  icon,
  label,
  href,
  external,
  className = '',
  iconW,
  iconSize,
}: {
  icon: string;
  label: string;
  href: string;
  external?: boolean;
  className?: string;
  iconW: string;
  iconSize: string;
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={`${ICON_COL} ${iconW} ${iconSize} text-black transition-opacity hover:opacity-75 ${className}`}
      title={label}
      aria-label={label}
    >
      {icon}
    </a>
  );
}

/** Business card — pink border, neomorphic gold actions, aligned rows, logo + QR same size */
export function BusinessCardDisplay({
  name,
  credentials,
  address,
  phone,
  email,
  inviteCode,
  store,
  businessLogoUrl: logoOverride,
  user,
  compact = false,
}: Props) {
  const qrValue = buildQrPayload('business', inviteCode);
  const displayName = credentials ? `${name} ${credentials}` : name;
  const storeLink = store ?? { type: 'none' as const };
  const logoClickable = storeLink.type !== 'none';
  const logoSrc = resolveBusinessLogoUrl(user ?? null, logoOverride);
  const square = compact ? 72 : 80;
  const qrSize = compact ? 56 : 64;
  const rowName = compact ? 'h-10' : 'h-11';
  const rowContact = compact ? 'h-8' : 'h-9';
  const rowDivider = compact ? 'h-2.5' : 'h-3';
  const padY = compact ? 'py-3' : 'py-4';
  const minH = compact ? 'min-h-[176px]' : 'min-h-[220px]';
  const nameText = compact ? 'text-xs' : 'text-[13px] sm:text-sm';
  const bodyText = compact ? 'text-[10px]' : 'text-[11px] sm:text-xs';
  const phoneText = compact ? 'text-[11px]' : 'text-xs sm:text-[13px]';
  const iconSize = compact ? 'text-[14px]' : 'text-[15px]';
  const iconW = compact ? 'w-10' : 'w-11';
  const pillInset = compact ? 'bottom-2.5 left-1 top-2.5 w-9' : 'bottom-3 left-1.5 top-3 w-10';

  const logoBox = (
    <div
      className="overflow-hidden rounded-lg border-2 border-[#d4a017]/55 bg-black"
      style={{ width: square, height: square }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} alt="" className="h-full w-full object-cover" />
    </div>
  );

  const qrBox = (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className="flex items-center justify-center overflow-hidden rounded-lg border border-[#ff1493]/40 bg-white p-1"
        style={{ width: square, height: square }}
      >
        <QrDisplay value={qrValue} size={qrSize} fgColor="#ff1493" />
      </div>
      <span className="max-w-[80px] text-center text-[6px] leading-tight text-[var(--ps-dim)]">
        Scan → Business contacts
      </span>
    </div>
  );

  return (
    <div
      className={`overflow-hidden rounded-xl border-2 border-[#ff1493] bg-black ${
        compact ? 'text-[10px]' : ''
      }`}
    >
      <div className={`relative flex ${minH}`}>
        <div className={`relative flex min-w-0 flex-1 flex-col justify-center ${padY}`}>
          <div
            className={`pointer-events-none absolute ${pillInset} ps-bizcard-gold-pill`}
            aria-hidden
          />

          <div className={`flex ${rowName} items-end pb-1`}>
            <GoldAction icon="👤" label="Profile" href="#profile" iconW={iconW} iconSize={iconSize} />
            <div className={`min-w-0 flex-1 pl-3.5 pr-2 font-bold leading-tight text-[var(--ps-white)] ${nameText}`}>
              {displayName}
            </div>
          </div>

          <div className={`flex ${rowDivider} items-center`}>
            <div className={`${ICON_COL} ${iconW} pointer-events-none`}>
              <div className="mx-2 h-px w-7 bg-black/35" />
            </div>
            <div className="h-0.5 flex-1 rounded-full bg-gradient-to-r from-transparent via-[#d4a017] to-transparent" />
          </div>

          <div className={`flex ${rowContact} items-center`}>
            <GoldAction
              icon="📍"
              label="Directions"
              href={mapsDirectionsUrl(address)}
              external
              iconW={iconW}
              iconSize={iconSize}
            />
            <div className={`min-w-0 flex-1 pl-3.5 pr-2 leading-snug ${bodyText}`}>
              <a
                href={mapsDirectionsUrl(address)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/85 transition-colors hover:text-[var(--ps-cyan)]"
              >
                {address}
              </a>
            </div>
          </div>

          <div className={`flex ${rowContact} items-center`}>
            <GoldAction icon="📞" label="Call" href={telUrl(phone)} iconW={iconW} iconSize={iconSize} />
            <div className={`min-w-0 flex-1 pl-3.5 pr-2 font-medium ${phoneText}`}>
              <a href={telUrl(phone)} className="text-[var(--ps-white)] transition-colors hover:text-[var(--ps-cyan)]">
                {phone}
              </a>
            </div>
          </div>

          <div className={`flex ${rowContact} items-center`}>
            <GoldAction
              icon="✉️"
              label="Email"
              href={gmailComposeUrl(email)}
              external
              iconW={iconW}
              iconSize={iconSize}
            />
            <div className={`min-w-0 flex-1 break-all pl-3.5 pr-2 text-white/85 ${bodyText}`}>
              {email}
            </div>
          </div>
        </div>

        <div className="flex w-[92px] shrink-0 flex-col items-center justify-center gap-2 border-l border-[#ff1493]/30 bg-black px-2 py-2 sm:w-[96px]">
          {logoClickable ? (
            <a
              href={storeLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-85"
              title={storeMessage(storeLink)}
            >
              {logoBox}
            </a>
          ) : (
            <div title={storeMessage(storeLink)}>{logoBox}</div>
          )}
          {qrBox}
        </div>
      </div>
      {storeLink.type === 'none' && (
        <p className="border-t border-[#ff1493]/20 px-3 py-1.5 text-center text-[8px] text-[var(--ps-dim)]">
          {storeMessage(storeLink)}
        </p>
      )}
    </div>
  );
}
