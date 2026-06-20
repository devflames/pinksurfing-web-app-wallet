'use client';

import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';
import type { AppSection, ChatTab } from '@pinksurfing/ui';
import type { ExploreScreenId } from '@/lib/explore-types';

export type ShopMode = 'browse' | 'sell';

export type ShellNavOptions = {
  tab?: ChatTab;
  contactId?: string;
  shopMode?: ShopMode;
  exploreScreen?: ExploreScreenId;
};

type ShellNavContextValue = {
  section: AppSection;
  shopMode: ShopMode;
  toast: string | null;
  navigate: (section: AppSection, options?: ShellNavOptions) => void;
  showToast: (message: string) => void;
  clearToast: () => void;
};

const ShellNavContext = createContext<ShellNavContextValue | null>(null);

export function ShellNavProvider({
  section,
  shopMode,
  onNavigate,
  children,
}: {
  section: AppSection;
  shopMode: ShopMode;
  onNavigate: (section: AppSection, options?: ShellNavOptions) => void;
  children: ReactNode;
}) {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  const navigate = useCallback(
    (next: AppSection, options?: ShellNavOptions) => {
      onNavigate(next, options);
    },
    [onNavigate]
  );

  return (
    <ShellNavContext.Provider
      value={{ section, shopMode, toast, navigate, showToast, clearToast }}
    >
      {children}
    </ShellNavContext.Provider>
  );
}

export function useShellNav() {
  const ctx = useContext(ShellNavContext);
  if (!ctx) throw new Error('useShellNav must be used within ShellNavProvider');
  return ctx;
}
