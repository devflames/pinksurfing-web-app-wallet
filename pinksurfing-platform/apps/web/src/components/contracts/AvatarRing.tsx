'use client';

import type { BusinessAvatarRing } from '@/lib/business-chat-ring';
import { businessAvatarRingStyle, businessAvatarRingTitle } from '@/lib/business-chat-ring';

/** Thin status ring — color only on the border, not the photo */
export const AVATAR_RING_WIDTH = 2;

type Props = {
  ring?: BusinessAvatarRing;
  size: number;
  children: React.ReactNode;
  className?: string;
};

/**
 * Wraps a profile or group avatar with a colored status ring.
 * The child image/initials are unchanged; only the border ring is colored.
 */
export function AvatarRing({ ring, size, children, className = '' }: Props) {
  const gradient = businessAvatarRingStyle(ring);
  const hasRing = ring && ring !== 'none' && gradient;

  if (!hasRing) {
    return <div className={`inline-flex shrink-0 ${className}`}>{children}</div>;
  }

  const outer = size + AVATAR_RING_WIDTH * 2;
  const inset = AVATAR_RING_WIDTH;

  return (
    <div
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: outer, height: outer }}
      title={businessAvatarRingTitle(ring)}
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={gradient}
        aria-hidden
      />
      <div
        className="absolute overflow-hidden rounded-full bg-[var(--ps-bg)]"
        style={{
          top: inset,
          left: inset,
          width: size,
          height: size,
        }}
      >
        <div className="h-full w-full overflow-hidden rounded-full">{children}</div>
      </div>
    </div>
  );
}
