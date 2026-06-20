'use client';

import type { DiscoverPerson } from '@/lib/discover-people';

type Props = {
  people: DiscoverPerson[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function FindPeopleGrid({ people, selectedId, onSelect }: Props) {
  if (people.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-[10px] text-[var(--ps-dim)]">
        No people match these filters — try a wider radius or different industry.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-1.5 p-2">
      {people.map((p) => {
        const selected = p.id === selectedId;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={`group relative aspect-[3/4] overflow-hidden rounded-md border-2 transition-all ${
              selected
                ? 'border-[#9747ff] shadow-[0_0_12px_rgba(151,71,255,0.45)]'
                : 'border-transparent hover:border-[var(--ps-brd)]'
            }`}
          >
            <img
              src={p.avatarUrl}
              alt={p.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-sm bg-black/45 backdrop-blur-sm">
              {p.verified ? (
                <span className="text-[8px] font-bold text-white">V</span>
              ) : (
                <span className="h-2 w-2 rounded-sm bg-white/20" />
              )}
            </div>
            {selected && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#9747ff]/90 to-transparent px-1 py-1">
                <div className="truncate text-[7px] font-semibold text-white">{p.name}</div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
