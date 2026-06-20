'use client';

import { COVID_VACCINE_PORTALS, HEALTH_CARD_TYPES } from '@/lib/wallet-card-types';
import { EditableCardPanel } from './EditableCardPanel';

type Props = { email: string };

function CovidPortalHint({ fields }: { fields: Record<string, string> }) {
  const state = fields.vaccinationState;
  const portal = state ? COVID_VACCINE_PORTALS[state] : undefined;

  if (!portal) {
    return (
      <p className="rounded-lg border border-[var(--ps-brd)] bg-[var(--ps-surf)] px-3 py-2 text-[9px] leading-relaxed text-[var(--ps-muted)]">
        Select your vaccination state. California residents can request a digital record below; other states
        may offer their own portals.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--ps-cyan)]/30 bg-[var(--ps-surf)] p-3">
      <div className="text-[10px] font-medium text-[var(--ps-white)]">{portal.label}</div>
      <p className="text-[9px] leading-relaxed text-[var(--ps-muted)]">{portal.note}</p>
      <a
        href={portal.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-[10px] text-[var(--ps-cyan)] underline"
      >
        Request your record →
      </a>
      {fields.portalPin && (
        <p className="text-[9px] text-[var(--ps-dim)]">
          PIN saved locally — use it when the portal asks for your access PIN.
        </p>
      )}
    </div>
  );
}

export function HealthCardsPanel({ email }: Props) {
  return (
    <EditableCardPanel
      email={email}
      category="health"
      types={HEALTH_CARD_TYPES}
      emptyHint="Your memory + action health wallet. Add cards with nicknames, scan photos, and use-instructions — PinkSurfing reminds you before anything expires."
      renderTypeExtra={(typeId, fields) =>
        typeId === 'covid_vaccine' ? <CovidPortalHint fields={fields} /> : null
      }
    />
  );
}
