'use client';

import type { SessionUser } from '@/lib/types/user';
import { withBasePath } from '@/lib/base-path';
import { displayName } from '@/lib/auth-storage';
import { SettingsIcon } from '@/components/icons/SettingsIcon';

const AVATAR_SIZE = 88;
const OVERLAP_RATIO = 0.4;
const SHIFT = Math.round(AVATAR_SIZE * (1 - OVERLAP_RATIO));

const DEFAULT_PERSONAL_IMG =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=176&h=176&fit=crop&crop=face';
const DEFAULT_BUSINESS_IMG = withBasePath('/nav/explore.png');

type Props = {
  user: SessionUser | null;
  personalLabel: string;
  businessLabel: string;
  /** Which photo is in front in the Me section stack (local display only). */
  frontPhoto?: 'personal' | 'business';
  onSwap: () => void;
  variant?: 'header' | 'nav';
  onOpenSettings?: () => void;
};

function PersonalAvatar({
  label,
  imageUrl,
  size,
  active,
}: {
  label: string;
  imageUrl?: string;
  size: number;
  active: boolean;
}) {
  const initial = label.trim().slice(0, 1).toUpperCase() || '?';
  const src = imageUrl || DEFAULT_PERSONAL_IMG;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border-2 transition-all duration-300 ${
        active
          ? 'z-20 border-[var(--ps-pink)]/70 opacity-100 shadow-[0_0_20px_rgba(151,71,255,0.25)]'
          : 'z-10 border-white/15 opacity-40 grayscale'
      }`}
      style={{ width: size, height: size }}
    >
      {imageUrl || src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-[var(--ps-card2)] font-semibold text-[var(--ps-pink)]"
          style={{ fontSize: size * 0.35 }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

function BusinessAvatar({
  label,
  imageUrl,
  size,
  active,
}: {
  label: string;
  imageUrl?: string;
  size: number;
  active: boolean;
}) {
  const initial = label.trim().slice(0, 1).toUpperCase() || 'B';
  const src = imageUrl || DEFAULT_BUSINESS_IMG;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-300 ${
        active
          ? 'z-20 border-[#d4a017] opacity-100 shadow-[0_0_0_2px_rgba(212,160,23,0.35),0_0_20px_rgba(212,160,23,0.2)]'
          : 'z-10 border-white/15 opacity-40 grayscale'
      }`}
      style={{ width: size, height: size }}
    >
      {imageUrl || src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2a1f0a] to-[#1a1408] font-semibold text-[#d4a017]"
          style={{ fontSize: size * 0.35 }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

export function profileAvatarUrl(user: SessionUser | null): string | undefined {
  const u = user as SessionUser & { avatarUrl?: string };
  return u?.avatarUrl;
}

export function businessLogoUrl(user: SessionUser | null): string | undefined {
  const u = user as SessionUser & { businessLogoUrl?: string };
  return u?.businessLogoUrl;
}

/** Same image as Me section business avatar behind profile */
export function resolveBusinessLogoUrl(user: SessionUser | null, override?: string): string {
  return override || businessLogoUrl(user) || DEFAULT_BUSINESS_IMG;
}

export function ProfileAvatarStack({
  user,
  personalLabel,
  businessLabel,
  frontPhoto = 'personal',
  onSwap,
  variant = 'header',
  onOpenSettings,
}: Props) {
  const personalInFront = frontPhoto === 'personal';
  const personalImg = profileAvatarUrl(user);
  const businessImg = businessLogoUrl(user);

  if (variant === 'nav') {
    const src = personalImg || DEFAULT_PERSONAL_IMG;
    return (
      <div className="h-7 w-7 overflow-hidden rounded-full border border-[var(--ps-pink)]/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  const activeLabel = personalInFront ? personalLabel : businessLabel;
  const stackWidth = AVATAR_SIZE + SHIFT;

  return (
    <div className="flex items-center justify-center gap-4">
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: stackWidth, height: AVATAR_SIZE }}>
          <div className="absolute left-0 top-0">
            <BusinessAvatar
              label={businessLabel}
              imageUrl={businessImg}
              size={AVATAR_SIZE}
              active={!personalInFront}
            />
          </div>
          <div className="absolute top-0" style={{ left: SHIFT }}>
            <PersonalAvatar
              label={personalLabel}
              imageUrl={personalImg}
              size={AVATAR_SIZE}
              active={personalInFront}
            />
          </div>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="absolute z-30 flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-card)]/95 text-[var(--ps-muted)] shadow-md backdrop-blur-sm transition-colors hover:border-[var(--ps-cyan)]/40 hover:text-[var(--ps-white)]"
              style={{ left: SHIFT - 4, top: -4 }}
              aria-label="Open settings"
              title="Personal & business details"
            >
              <SettingsIcon size={14} />
            </button>
          )}
        </div>
        <div className="mt-2.5 text-base font-semibold text-[var(--ps-white)]">{activeLabel}</div>
      </div>

      <button
        type="button"
        onClick={onSwap}
        aria-label="Swap which photo is in front"
        title="Swap which photo is in front (Me section only)"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--ps-brd)] bg-[var(--ps-surf)] text-[var(--ps-muted)] transition-colors hover:border-[var(--ps-cyan)]/40 hover:text-[var(--ps-cyan)]"
      >
        <span className="text-lg leading-none">⇄</span>
      </button>
    </div>
  );
}
