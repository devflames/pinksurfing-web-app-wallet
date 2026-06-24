'use client';

import { useShellNav } from '@/lib/shell-nav-context';
import {
  DepositWithdrawScreen,
  InvoiceScreen,
  ListingsScreen,
  PayReceiveScreen,
  SimpleFeatureScreen,
} from './explore-screens';

import type { ExploreScreenId } from '@/lib/explore-types';

export type { ExploreScreenId };

const TILES: {
  id: ExploreScreenId | 'mall' | 'sell';
  title: string;
  featured?: boolean;
  desc: string;
  icon: string;
}[] = [
  { id: 'pay', title: 'Pay and Receive', featured: true, desc: 'Send or request payments', icon: '💸' },
  { id: 'invoice', title: 'Create Invoice', featured: true, desc: 'Bill clients on-platform', icon: '📄' },
  { id: 'deposit', title: 'Deposit and Withdraw', desc: 'KeyVault XCH in/out', icon: '🏦' },
  { id: 'mall', title: 'Shopping Mall and Marketplace', desc: 'Browse vendors on Shop', icon: '🛍' },
  { id: 'sell', title: 'Sell Item / Create your shop', desc: 'Open your storefront', icon: '🏪' },
  // { id: 'trade', title: 'Trade Arena', desc: 'Swap and trade assets', icon: '📈' },
  {
    id: 'health',
    title: 'Remote monitoring Healthcare for On-the-go professionals',
    desc: 'Stratton Health — remote monitoring',
    icon: '🏥',
  },
  { id: 'video', title: 'Video', desc: 'Media hub', icon: '🎬' },
  // { id: 'game', title: 'Game: V Juris Forces', desc: 'Play in-app', icon: '🎮' },
  { id: 'gigs', title: 'Gigs/Freelance', desc: 'Find or post gigs', icon: '⚡' },
  { id: 'jobs', title: 'Job Posting', desc: 'Hire or apply', icon: '💼' },
];

function FeatureTile({
  title,
  desc,
  icon,
  featured,
  onClick,
}: {
  title: string;
  desc: string;
  icon: string;
  featured?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ps-neu-explore flex min-h-[84px] items-start gap-3 px-4 py-3.5 text-left ${
        featured ? 'ps-neu-explore-featured' : ''
      }`}
    >
      <span className="ps-neu-icon mt-0.5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-medium text-[var(--ps-white)]">{title}</span>
        <span className="mt-1 block text-[10px] leading-snug text-[var(--ps-dim)]">{desc}</span>
      </span>
      <span className="mt-1 shrink-0 text-[10px] text-[var(--ps-dim)]">→</span>
    </button>
  );
}

type Props = {
  screen: ExploreScreenId;
  onScreenChange: (id: ExploreScreenId) => void;
};

export function ExploreView({ screen, onScreenChange }: Props) {
  const { navigate, showToast } = useShellNav();
  const back = () => onScreenChange('list');

  const toast = (msg: string) => showToast(msg);

  if (screen === 'pay') {
    return <PayReceiveScreen onBack={back} onSuccess={toast} />;
  }
  if (screen === 'invoice') {
    return <InvoiceScreen onBack={back} />;
  }
  if (screen === 'deposit') {
    return <DepositWithdrawScreen onBack={back} onSuccess={toast} />;
  }
  // if (screen === 'trade') {
  //   return (
  //     <SimpleFeatureScreen
  //       title="Trade Arena"
  //       subtitle="Asset swaps and trading"
  //       body="Trade Arena connects to Matt wallet swaps and Raihan business contracts. Demo mode shows the UI shell — enable wallet live for real trades."
  //       cta="View open swaps"
  //       onBack={back}
  //       onCta={() => {
  //         toast('Swap list loaded (demo)');
  //         navigate('home', { tab: 'business' });
  //       }}
  //     />
  //   );
  // }
  if (screen === 'video') {
    return (
      <SimpleFeatureScreen
        title="Video"
        subtitle="Media hub"
        body="Video calls are available in any chat — tap ☎ or ▶ in the chat header. Agora powers voice and video on web and mobile."
        cta="Open chats"
        onBack={back}
        onCta={() => navigate('home', { tab: 'personal' })}
      />
    );
  }
  // if (screen === 'game') {
  //   return (
  //     <SimpleFeatureScreen
  //       title="Game: V Juris Forces"
  //       subtitle="In-app game (Flutter stub)"
  //       body="V Juris Forces is listed in Flutter Explore as a placeholder. Web shows this preview until the game module ships."
  //       cta="Notify me when live"
  //       onBack={back}
  //       onCta={() => toast("You're on the waitlist (demo)")}
  //     />
  //   );
  // }

  const handleTile = (id: (typeof TILES)[number]['id']) => {
    if (id === 'health') {
      window.open('https://strattonhealth.com', '_blank', 'noopener,noreferrer');
      return;
    }
    if (id === 'gigs') {
      window.open('https://pinksurfing.com/gighub', '_blank', 'noopener,noreferrer');
      return;
    }
    if (id === 'jobs') {
      window.open('https://pinksurfing.com/gigs?category_slug=jobs-offered', '_blank', 'noopener,noreferrer');
      return;
    }
    if (id === 'mall') {
      navigate('shop', { shopMode: 'browse' });
      return;
    }
    if (id === 'sell') {
      window.open('https://vendors.pinksurfing.com/inventory/add_products', '_blank', 'noopener,noreferrer');
      return;
    }
    onScreenChange(id);
  };

  return (
    <div>
      <p className="mb-4 text-[11px] text-[var(--ps-dim)]">
        Marketplace, payments, and services — tap any tile. Shop tiles open the Shop tab.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
        {TILES.map((t) => (
          <FeatureTile
            key={t.id}
            title={t.title}
            desc={t.desc}
            icon={t.icon}
            featured={t.featured}
            onClick={() => handleTile(t.id)}
          />
        ))}
      </div>
    </div>
  );
}
