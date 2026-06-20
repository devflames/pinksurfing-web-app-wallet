import type { ColdContactLikelihood } from '@/lib/cold-contact-likelihood';
import type { ProfileStatusCategory } from '@/lib/profile-status-options';
import type { DiscoverFilters } from '@/lib/discover-people';
import { filterByDiscoverFilters } from '@/lib/discover-people';
import { withBasePath } from '@/lib/base-path';

export type TeamPerson = {
  id: string;
  name: string;
  position: string;
  industryCategory: string;
  industry: string;
  location: string;
  state: string;
  lat: number;
  lng: number;
  avatarUrl: string;
  businessLogoUrl?: string;
  businessName?: string;
  statusMood: string;
  statusCategory: ProfileStatusCategory;
  aboutMe?: string;
  dealsInterestedIn?: string[];
  coldContactLikelihood: ColdContactLikelihood;
};

export type BusinessGroup = {
  id: string;
  label: string;
  businessName: string;
  adminName: string;
  adminAvatarUrl: string;
  logoUrl: string;
  defaultMemberIds: string[];
};

/** Unique demo portraits — one per person */
const PHOTOS = {
  adminYou:
    'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=320&h=320&fit=crop',
  scarlett:
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=320&h=320&fit=crop',
  michael:
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=320&h=320&fit=crop',
  solar:
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=320&h=320&fit=crop',
  rita:
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=320&h=320&fit=crop',
  jamie:
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=320&h=320&fit=crop',
} as const;

/** Demo rolodex: 5 direct contacts (matches visible profile count) */
const DEMO_DIRECT: TeamPerson[] = [
  {
    id: 'dc-c1',
    name: 'Scarlett Jenner',
    position: 'Project Lead',
    industryCategory: 'Construction & Real Estate',
    industry: 'Painting',
    location: 'Austin, TX',
    state: 'TX',
    lat: 30.27,
    lng: -97.74,
    avatarUrl: PHOTOS.scarlett,
    businessName: 'Surf Exterior Co.',
    businessLogoUrl: withBasePath('/nav/explore.png'),
    aboutMe:
      'Exterior specialist focused on commercial repaint and stucco repair in the Austin market.',
    dealsInterestedIn: ['Commercial repaint', 'HOA exterior bids', 'Referral partnerships'],
    coldContactLikelihood: 'low',
    statusMood: 'Available for exterior work',
    statusCategory: 'business',
  },
  {
    id: 'dc-c2',
    name: 'Michael Adams',
    position: 'Operations Manager',
    industryCategory: 'Energy, Utilities & Environmental',
    industry: 'Solar',
    location: 'Dallas, TX',
    state: 'TX',
    lat: 32.78,
    lng: -96.8,
    avatarUrl: PHOTOS.michael,
    businessName: 'Solar Install Co.',
    businessLogoUrl: withBasePath('/nav/shop.png'),
    aboutMe:
      'Scaling residential solar installs — looking for roofing partners and qualified installers.',
    dealsInterestedIn: ['Roofing referrals', 'Battery add-ons', 'Commercial solar'],
    coldContactLikelihood: 'high',
    statusMood: 'In Execution Mode',
    statusCategory: 'business',
  },
  {
    id: 'dc-c3',
    name: 'Paint Exterior',
    position: 'General Contractor',
    industryCategory: 'Construction & Real Estate',
    industry: 'General Contracting',
    location: 'Austin, TX',
    state: 'TX',
    lat: 30.27,
    lng: -97.74,
    avatarUrl: PHOTOS.solar,
    businessName: 'Surf Exterior Co.',
    businessLogoUrl: withBasePath('/nav/explore.png'),
    aboutMe: 'General contractor — exterior paint, stucco, and commercial bids.',
    dealsInterestedIn: ['Subcontractor crews', 'Material supply', 'Commercial bids'],
    coldContactLikelihood: 'moderate',
    statusMood: 'Closing Deals',
    statusCategory: 'business',
  },
  {
    id: 'dc-extra-1',
    name: 'Rita Nguyen',
    position: 'Manager',
    industryCategory: 'Construction & Real Estate',
    industry: 'HVAC',
    location: 'Houston, TX',
    state: 'TX',
    lat: 29.76,
    lng: -95.37,
    avatarUrl: PHOTOS.rita,
    businessName: 'CoolAir HVAC',
    businessLogoUrl: withBasePath('/nav/shop.png'),
    aboutMe: 'Commercial HVAC installs and service contracts across Texas.',
    dealsInterestedIn: ['Maintenance contracts', 'New construction', 'Referrals'],
    coldContactLikelihood: 'moderate',
    statusMood: 'In Execution Mode',
    statusCategory: 'business',
  },
  {
    id: 'dc-extra-4',
    name: 'Jamie Brooks',
    position: 'Coordinator',
    industryCategory: 'Transportation, Logistics & Supply Chain',
    industry: 'Freight & Shipping',
    location: 'Austin, TX',
    state: 'TX',
    lat: 30.27,
    lng: -97.74,
    avatarUrl: PHOTOS.jamie,
    businessName: 'FedEx Logistics',
    businessLogoUrl: withBasePath('/nav/shop.png'),
    aboutMe: 'Freight coordination and last-mile routing for regional carriers.',
    dealsInterestedIn: ['Fleet partners', 'Warehouse space', 'Route sharing'],
    coldContactLikelihood: 'low',
    statusMood: 'On Fire',
    statusCategory: 'mood',
  },
];

export const DEMO_GROUPS: BusinessGroup[] = [
  {
    id: 'grp-fedex',
    label: 'Team 1: FedEx',
    businessName: 'FedEx Logistics',
    adminName: 'You',
    adminAvatarUrl: PHOTOS.adminYou,
    logoUrl: withBasePath('/nav/shop.png'),
    defaultMemberIds: ['dc-c1', 'dc-c2', 'dc-c3', 'dc-extra-4', 'dc-extra-1'],
  },
  {
    id: 'grp-paint',
    label: 'Paint Exterior Crew',
    businessName: 'Surf Exterior Co.',
    adminName: 'Scarlett Jenner',
    adminAvatarUrl: PHOTOS.scarlett,
    logoUrl: withBasePath('/nav/explore.png'),
    defaultMemberIds: ['dc-c1', 'dc-c3', 'dc-extra-1'],
  },
];

export const CONTACT_CAPACITY_STEP = 250;
export const CONTACT_CAPACITY_UPGRADE_USD = 1;
const CAPACITY_KEY = 'ps-contact-capacity';

export function directContactCatalog(): TeamPerson[] {
  return DEMO_DIRECT;
}

export function directContactCount(): number {
  return DEMO_DIRECT.length;
}

export function findDirectContact(id: string): TeamPerson | undefined {
  return DEMO_DIRECT.find((p) => p.id === id);
}

export function findGroup(id: string): BusinessGroup | undefined {
  return DEMO_GROUPS.find((g) => g.id === id);
}

export function groupForContact(groupId: string | undefined): BusinessGroup | undefined {
  if (!groupId) return undefined;
  return findGroup(groupId);
}

export function loadContactCapacity(email: string): number {
  if (typeof window === 'undefined') return CONTACT_CAPACITY_STEP;
  try {
    const raw = localStorage.getItem(`${CAPACITY_KEY}:${email || 'guest'}`);
    return raw ? Number(raw) : CONTACT_CAPACITY_STEP;
  } catch {
    return CONTACT_CAPACITY_STEP;
  }
}

export function upgradeContactCapacity(email: string): number {
  const next = loadContactCapacity(email) + CONTACT_CAPACITY_STEP;
  if (typeof window !== 'undefined') {
    localStorage.setItem(`${CAPACITY_KEY}:${email || 'guest'}`, String(next));
  }
  return next;
}

/** Group mosaic: admin (head) + up to 3 unique member photos */
export function groupAvatarUrlsFor(email: string, groupId: string): string[] {
  const group = findGroup(groupId);
  if (!group) return [];
  const memberIds = loadGroupMemberIds(email, groupId);
  const urls = [group.adminAvatarUrl];
  const seen = new Set<string>([group.adminAvatarUrl]);
  for (const id of memberIds) {
    if (urls.length >= 4) break;
    const p = findDirectContact(id);
    if (p && !seen.has(p.avatarUrl)) {
      urls.push(p.avatarUrl);
      seen.add(p.avatarUrl);
    }
  }
  return urls;
}

const MEMBERS_KEY = 'ps-group-members';

function membersKey(email: string, groupId: string): string {
  return `${MEMBERS_KEY}:${email || 'guest'}:${groupId}`;
}

export function loadGroupMemberIds(email: string, groupId: string): string[] {
  const group = findGroup(groupId);
  if (!group) return [];
  if (typeof window === 'undefined') return group.defaultMemberIds;
  try {
    const raw = localStorage.getItem(membersKey(email, groupId));
    return raw ? (JSON.parse(raw) as string[]) : group.defaultMemberIds;
  } catch {
    return group.defaultMemberIds;
  }
}

export function saveGroupMemberIds(email: string, groupId: string, ids: string[]): string[] {
  if (typeof window !== 'undefined') {
    localStorage.setItem(membersKey(email, groupId), JSON.stringify(ids));
  }
  return ids;
}

export function addGroupMember(email: string, groupId: string, personId: string): string[] {
  const current = loadGroupMemberIds(email, groupId);
  if (current.includes(personId)) return current;
  return saveGroupMemberIds(email, groupId, [...current, personId]);
}

export function removeGroupMember(email: string, groupId: string, personId: string): string[] {
  return saveGroupMemberIds(
    email,
    groupId,
    loadGroupMemberIds(email, groupId).filter((id) => id !== personId)
  );
}

export function filterDirectContacts(
  people: TeamPerson[],
  filters: DiscoverFilters
): TeamPerson[] {
  return filterByDiscoverFilters(people, filters);
}

export function directContactStates(): string[] {
  return ['All states', ...Array.from(new Set(DEMO_DIRECT.map((p) => p.state))).sort()];
}

export function nextGroupId(currentId: string): string {
  const idx = DEMO_GROUPS.findIndex((g) => g.id === currentId);
  const next = DEMO_GROUPS[(idx + 1) % DEMO_GROUPS.length];
  return next?.id ?? currentId;
}
