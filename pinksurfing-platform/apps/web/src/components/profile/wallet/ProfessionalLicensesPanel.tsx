'use client';

import { PROFESSIONAL_LICENSE_TYPES } from '@/lib/wallet-card-types';
import { EditableCardPanel } from './EditableCardPanel';

type Props = { email: string };

export function ProfessionalLicensesPanel({ email }: Props) {
  return (
    <EditableCardPanel
      email={email}
      category="professional"
      types={PROFESSIONAL_LICENSE_TYPES}
      emptyHint="Track licenses and policies with state, expiry, and action prompts — not just photos."
    />
  );
}
