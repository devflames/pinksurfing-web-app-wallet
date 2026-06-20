'use client';

import { ContactMiniProfilePanel } from '@/components/contacts/ContactMiniProfilePanel';
import { teamPersonToMiniProfile } from '@/lib/mini-profile';
import type { TeamPerson } from '@/lib/group-teams';

type Props = {
  person: TeamPerson;
  onVisit?: () => void;
};

export function TeamMiniProfileBar({ person, onVisit }: Props) {
  return (
    <ContactMiniProfilePanel person={teamPersonToMiniProfile(person)} onVisit={onVisit} />
  );
}
