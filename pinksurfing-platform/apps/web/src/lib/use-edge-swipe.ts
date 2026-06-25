'use client';

import { useCallback, useRef } from 'react';

/** Detect swipe from the left screen edge to open a panel (mobile contacts drawer) */
export function useEdgeSwipeOpen(onOpen: () => void, enabled: boolean) {
  const startX = useRef(0);
  const tracking = useRef(false);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      const x = e.touches[0]?.clientX ?? 0;
      if (x <= 28) {
        startX.current = x;
        tracking.current = true;
      }
    },
    [enabled]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !tracking.current) return;
      const x = e.touches[0]?.clientX ?? 0;
      if (x - startX.current > 48) {
        tracking.current = false;
        onOpen();
      }
    },
    [enabled, onOpen]
  );

  const onTouchEnd = useCallback(() => {
    tracking.current = false;
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
