import type { BusinessAvatarRing } from '@/lib/business-chat-ring';
import { businessAvatarRingClass } from '@/lib/business-chat-ring';

type Props = {
  urls: string[];
  size?: number;
  onClick?: () => void;
  title?: string;
  businessRing?: BusinessAvatarRing;
};

const FALLBACK =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop';

/** 2×2 participant mosaic — group head first, then up to 3 members */
export function GroupAvatar({
  urls,
  size = 34,
  onClick,
  title = 'Edit team',
  businessRing,
}: Props) {
  const cells = [...urls.slice(0, 4)];
  while (cells.length < 4) cells.push(FALLBACK);

  const ringCls = businessRing ? businessAvatarRingClass(businessRing) : '';

  const inner = (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border border-white/10 bg-[var(--ps-card)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_4px_14px_rgba(0,0,0,0.45)] backdrop-blur-sm ${ringCls}`}
      style={{ width: size, height: size }}
    >
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-black/80 p-px">
        {cells.map((url, i) => (
          <img
            key={`${url}-${i}`}
            src={url}
            alt=""
            className="h-full w-full object-cover"
          />
        ))}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={`shrink-0 rounded-full transition-all ${
          businessRing ? '' : 'ring-2 ring-transparent hover:ring-[#9747ff]/50'
        }`}
        title={title}
        aria-label={title}
      >
        {inner}
      </button>
    );
  }

  return inner;
}
