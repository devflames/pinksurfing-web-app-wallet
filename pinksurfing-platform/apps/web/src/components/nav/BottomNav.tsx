'use client';

import type { AppSection } from '@pinksurfing/ui';
import type { SessionUser } from '@/lib/types/user';
import { withBasePath } from '@/lib/base-path';
import { ProfileAvatarStack } from '@/components/profile/ProfileAvatarStack';

type NavItem = {
  id: AppSection;
  label: string;
  icon?: string;
  imageSrc?: string;
};

const ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'paychat', label: 'PayChat', imageSrc: '/nav/paychat.png' },
  { id: 'shop', label: 'Shop', imageSrc: '/nav/shop.png' },
  { id: 'share', label: 'Share', imageSrc: '/nav/share.png' },
  { id: 'explore', label: 'Explore', imageSrc: '/nav/explore.png' },
  { id: 'me', label: 'Me' },
];

function NavIconContent({
  item,
  user,
}: {
  item: NavItem;
  user: SessionUser | null;
}) {
  if (item.id === 'me') {
    return (
      <ProfileAvatarStack
        user={user}
        personalLabel=""
        businessLabel=""
        onSwap={() => {}}
        variant="nav"
      />
    );
  }

  if (item.imageSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={withBasePath(item.imageSrc)}
        alt=""
        className="h-7 w-7 rounded-full object-cover"
      />
    );
  }

  return <span className="text-[14px] leading-none">{item.icon}</span>;
}

type Props = {
  section: AppSection;
  onChange: (section: AppSection) => void;
  user?: SessionUser | null;
};

export function BottomNav({ section, onChange, user = null }: Props) {
  return (
    <nav className="ps-bottom-nav flex shrink-0 border-t border-[var(--ps-brd)] bg-[var(--ps-surf)]/95 backdrop-blur-sm">
      {ITEMS.map((item) => {
        const active = section === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] transition-colors ${
              active ? 'text-[var(--ps-pink)]' : 'text-[var(--ps-dim)] hover:text-[var(--ps-muted)]'
            }`}
          >
            {active && (
              <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-[var(--ps-pink)]" />
            )}
            <span
              className={`flex h-7 w-7 items-center justify-center overflow-hidden rounded-xl text-[14px] leading-none ${
                active ? 'bg-[var(--ps-pink)]/10' : ''
              }`}
            >
              <NavIconContent item={item} user={user} />
            </span>
            <span className={active ? 'font-medium' : ''}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export const SECTION_TITLES: Record<AppSection, string> = {
  home: 'PinkSurfing',
  paychat: 'Pay-Chat',
  shop: 'Shop Now',
  share: 'Share',
  explore: 'Explore',
  me: 'Profile',
};
