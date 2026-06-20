'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CATEGORY_ACCENT,
  PROFILE_STATUS_CATEGORIES,
  type ProfileStatusCategory,
  type ProfileStatusSelection,
} from '@/lib/profile-status-options';
import { clearProfileStatus, loadProfileStatus, setProfileStatus } from '@/lib/profile-status-storage';

type Props = {
  email: string;
  onChange?: (selection: ProfileStatusSelection) => void;
};

export function ProfileStatusPicker({ email, onChange }: Props) {
  const [selection, setSelection] = useState<ProfileStatusSelection>(() => loadProfileStatus(email));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  useEffect(() => {
    setSelection(loadProfileStatus(email));
  }, [email]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const place = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const width = Math.min(window.innerWidth - 16, 520);
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      setPanelStyle({ top: rect.bottom + 6, left, width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  const pick = useCallback(
    (category: ProfileStatusCategory, value: string) => {
      const isSame = selection.category === category && selection.value === value;
      const next = isSame ? clearProfileStatus(email) : setProfileStatus(email, category, value);
      setSelection(next);
      onChange?.(next);
      setOpen(false);
    },
    [email, onChange, selection.category, selection.value]
  );

  const accent = selection.category ? CATEGORY_ACCENT[selection.category] : null;

  return (
    <div
      ref={rootRef}
      className="relative grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--ps-brd)]/40 py-2.5 last:border-0"
    >
      <span className="text-[11px] text-[var(--ps-dim)]">Status / Mood</span>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-transparent px-1 py-0.5 text-right transition-colors hover:border-[var(--ps-brd)] hover:bg-[var(--ps-surf)]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selection.value ? (
          <>
            {accent && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: accent.color }}
              />
            )}
            <span
              className="whitespace-nowrap text-[11px] font-medium"
              style={{ color: accent?.color ?? 'var(--ps-white)' }}
            >
              {selection.value}
            </span>
          </>
        ) : (
          <span className="whitespace-nowrap text-[11px] text-[var(--ps-muted)]">Choose…</span>
        )}
        <span className="shrink-0 text-[9px] text-[var(--ps-dim)]">{open ? '▴' : '▾'}</span>
      </button>

      {open && panelStyle && (
        <div
          className="fixed z-50 overflow-hidden rounded-xl border border-[var(--ps-brd)] bg-[var(--ps-card)] shadow-xl"
          style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
          role="listbox"
        >
          <div className="grid grid-cols-4 divide-x divide-[var(--ps-brd)]">
            {PROFILE_STATUS_CATEGORIES.map((cat) => {
              const style = CATEGORY_ACCENT[cat.id];
              return (
                <div key={cat.id} className="flex min-w-0 flex-col">
                  <div
                    className="border-b px-1.5 py-2 text-center text-[8px] font-semibold leading-tight"
                    style={{ color: style.color, backgroundColor: style.bg }}
                  >
                    {cat.label}
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1">
                    {cat.options.map((opt) => {
                      const active = selection.category === cat.id && selection.value === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => pick(cat.id, opt)}
                          className="mb-0.5 w-full rounded px-1.5 py-1 text-left text-[8px] leading-snug transition-colors last:mb-0 hover:opacity-90"
                          style={
                            active
                              ? {
                                  color: style.color,
                                  backgroundColor: style.bg,
                                  border: `1px solid ${style.border}`,
                                }
                              : {
                                  color: 'var(--ps-muted)',
                                  border: '1px solid transparent',
                                }
                          }
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
