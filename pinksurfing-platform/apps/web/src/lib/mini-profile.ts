'use client';

import type { MiniProfileData } from '@/components/contacts/ContactMiniProfilePanel';
import type { DiscoverPerson } from '@/lib/discover-people';
import type { TeamPerson } from '@/lib/group-teams';

export function teamPersonToMiniProfile(person: TeamPerson): MiniProfileData {
  return {
    name: person.name,
    avatarUrl: person.avatarUrl,
    businessLogoUrl: person.businessLogoUrl,
    businessName: person.businessName,
    position: person.position,
    industryLabel: `${person.industryCategory} · ${person.industry}`,
    location: person.location,
    statusMood: person.statusMood,
    statusCategory: person.statusCategory,
    aboutMe: person.aboutMe,
    dealsInterestedIn: person.dealsInterestedIn,
  };
}

export function discoverPersonToMiniProfile(person: DiscoverPerson): MiniProfileData {
  return {
    name: person.name,
    avatarUrl: person.avatarUrl,
    businessLogoUrl: person.businessLogoUrl,
    businessName: person.businessName,
    position: person.position,
    industryLabel: `${person.industryCategory} · ${person.industry}`,
    location: person.location,
    statusMood: person.statusMood,
    statusCategory: person.statusCategory,
    aboutMe: person.aboutMe,
    dealsInterestedIn: person.dealsInterestedIn,
  };
}
