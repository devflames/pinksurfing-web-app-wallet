'use client';

import { useEffect, useState } from 'react';

/** Matches Tailwind `md` breakpoint — mobile shell activates below this width */
export const MOBILE_SHELL_MAX_WIDTH = 767;

export function useIsMobile(maxWidth = MOBILE_SHELL_MAX_WIDTH) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [maxWidth]);

  return isMobile;
}
