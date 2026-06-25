'use client';

import { useEffect } from 'react';
import { appDocumentTitle } from '@/lib/build-info';

type Props = {
  sectionLabel?: string;
};

/** Keeps browser tab title in sync with section + build SHA. */
export function BuildTabTitle({ sectionLabel }: Props) {
  useEffect(() => {
    document.title = appDocumentTitle(sectionLabel);
  }, [sectionLabel]);

  return null;
}
