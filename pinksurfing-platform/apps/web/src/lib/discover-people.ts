import type { ProfileStatusCategory } from '@/lib/profile-status-options';
import type { ColdContactLikelihood } from '@/lib/cold-contact-likelihood';
import { defaultIndustryFilters, matchesIndustryFilter } from '@/lib/industry-taxonomy';
import { allDirectoryBusinesses } from '@/lib/ps-business-directory';
import { businessProfileForContact } from '@/lib/business-profile-data';
import { withBasePath } from '@/lib/base-path';

export type DiscoverPerson = {
  id: string;
  name: string;
  businessName: string;
  position: string;
  industryCategory: string;
  industry: string;
  location: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  avatarUrl: string;
  businessLogoUrl?: string;
  statusMood: string;
  statusCategory: ProfileStatusCategory;
  paychatId: string;
  verified: boolean;
  contactId?: string;
  aboutMe?: string;
  dealsInterestedIn?: string[];
  coldContactLikelihood: ColdContactLikelihood;
};

const AVATARS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1521119989652-a1145319f972?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1556157382-97eda2d62296?w=320&h=320&fit=crop',
  'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=320&h=320&fit=crop',
];

const STATUS_SAMPLES: { value: string; category: ProfileStatusCategory }[] = [
  { value: 'Closing Deals', category: 'business' },
  { value: 'In the Zone', category: 'mood' },
  { value: 'Open to Partnerships', category: 'business' },
  { value: 'On Fire', category: 'mood' },
  { value: 'Available for projects', category: 'business' },
  { value: 'Building quietly', category: 'business' },
  { value: 'Motivated', category: 'mood' },
  { value: 'Seeking Talent', category: 'business' },
];

const GEO: Record<string, { lat: number; lng: number; state: string; zip: string }> = {
  'Austin, TX': { lat: 30.2672, lng: -97.7431, state: 'TX', zip: '78701' },
  'Dallas, TX': { lat: 32.7767, lng: -96.797, state: 'TX', zip: '75201' },
  'Houston, TX': { lat: 29.7604, lng: -95.3698, state: 'TX', zip: '77002' },
  'San Francisco, CA': { lat: 37.7749, lng: -122.4194, state: 'CA', zip: '94102' },
  'Los Angeles, CA': { lat: 34.0522, lng: -118.2437, state: 'CA', zip: '90012' },
  'Beverly Hills, CA': { lat: 34.0736, lng: -118.4004, state: 'CA', zip: '90210' },
  'Denver, CO': { lat: 39.7392, lng: -104.9903, state: 'CO', zip: '80202' },
  'Miami, FL': { lat: 25.7617, lng: -80.1918, state: 'FL', zip: '33130' },
  'Chicago, IL': { lat: 41.8781, lng: -87.6298, state: 'IL', zip: '60601' },
  'Seattle, WA': { lat: 47.6062, lng: -122.3321, state: 'WA', zip: '98101' },
};

const POSITIONS = [
  'Manager',
  'Project Lead',
  'Operations Manager',
  'General Contractor',
  'Founder',
  'Director',
  'Consultant',
  'Specialist',
];

function geoFor(location: string) {
  return (
    GEO[location] ?? {
      lat: 30.27,
      lng: -97.74,
      state: location.split(', ')[1] ?? 'TX',
      zip: '78701',
    }
  );
}

function buildDiscoverCatalog(): DiscoverPerson[] {
  const list: DiscoverPerson[] = [];
  let avatarIdx = 0;

  for (const biz of allDirectoryBusinesses()) {
    const profile = biz.contactId ? businessProfileForContact(biz.contactId) : null;
    const g = geoFor(biz.location);
    const status = STATUS_SAMPLES[avatarIdx % STATUS_SAMPLES.length];
    list.push({
      id: biz.id,
      name: biz.contactName,
      businessName: biz.businessName,
      position: profile?.position ?? POSITIONS[avatarIdx % POSITIONS.length],
      industry: biz.industry,
      industryCategory: biz.industryCategory,
      location: biz.location,
      state: g.state,
      zip: g.zip,
      lat: g.lat,
      lng: g.lng,
      avatarUrl: profile?.avatarUrl ?? AVATARS[avatarIdx % AVATARS.length],
      businessLogoUrl: profile?.businessLogoUrl ?? withBasePath('/nav/explore.png'),
      statusMood: profile?.status ?? status.value,
      statusCategory: status.category,
      paychatId: biz.paychatId,
      verified: !!biz.contactId,
      contactId: biz.contactId,
      aboutMe: profile?.aboutMe,
      dealsInterestedIn: profile?.dealsInterestedIn,
      coldContactLikelihood: profile?.coldContactLikelihood ?? 'moderate',
    });
    avatarIdx++;
  }

  const extras: Omit<DiscoverPerson, 'id' | 'paychatId'>[] = [
    {
      name: 'Lisa Chen',
      businessName: 'TechFlow Solutions',
      position: 'Manager',
      industryCategory: 'Technology & Software',
      industry: 'SaaS',
      location: 'Beverly Hills, CA',
      state: 'CA',
      zip: '90210',
      lat: 34.0736,
      lng: -118.4004,
      avatarUrl: AVATARS[2],
      businessLogoUrl: withBasePath('/nav/shop.png'),
      statusMood: 'Rainmaking',
      statusCategory: 'mood',
      verified: true,
      aboutMe: 'SaaS for logistics teams — open to API partnerships and channel deals.',
      dealsInterestedIn: ['Integrations', 'Channel partners', 'Enterprise pilots'],
      coldContactLikelihood: 'high',
    },
    {
      name: 'Marcus Webb',
      businessName: 'Webb Capital',
      position: 'Director',
      industryCategory: 'Finance, Insurance & Professional Services',
      industry: 'Venture Capital',
      location: 'Los Angeles, CA',
      state: 'CA',
      zip: '90012',
      lat: 34.0522,
      lng: -118.2437,
      avatarUrl: AVATARS[4],
      statusMood: 'Raising Capital',
      statusCategory: 'business',
      verified: false,
      aboutMe: 'Early-stage VC focused on trades, proptech, and climate.',
      dealsInterestedIn: ['Seed rounds', 'Co-invest', 'Deal flow'],
      coldContactLikelihood: 'moderate',
    },
    {
      name: 'Elena Ruiz',
      businessName: 'Ruiz Design Studio',
      position: 'Founder',
      industryCategory: 'Media, Entertainment & Creative',
      industry: 'Graphic Design',
      location: 'Austin, TX',
      state: 'TX',
      zip: '78701',
      lat: 30.2672,
      lng: -97.7431,
      avatarUrl: AVATARS[5],
      statusMood: 'Creative',
      statusCategory: 'mood',
      verified: true,
      aboutMe: 'Brand and visual design for hospitality and retail.',
      dealsInterestedIn: ['Brand packages', 'Retainers', 'Referrals'],
      coldContactLikelihood: 'moderate',
    },
    {
      name: 'James Porter',
      businessName: 'Porter Roofing',
      position: 'General Contractor',
      industryCategory: 'Construction & Real Estate',
      industry: 'Roofing',
      location: 'Dallas, TX',
      state: 'TX',
      zip: '75201',
      lat: 32.7767,
      lng: -96.797,
      avatarUrl: AVATARS[6],
      statusMood: 'In Execution Mode',
      statusCategory: 'business',
      verified: false,
      aboutMe: 'Commercial roofing and storm restoration across DFW.',
      dealsInterestedIn: ['Insurance jobs', 'GC partnerships', 'Sub crews'],
      coldContactLikelihood: 'low',
    },
    {
      name: 'Nina Okonkwo',
      businessName: 'Okonkwo Legal',
      position: 'Consultant',
      industryCategory: 'Finance, Insurance & Professional Services',
      industry: 'Legal Services',
      location: 'Houston, TX',
      state: 'TX',
      zip: '77002',
      lat: 29.7604,
      lng: -95.3698,
      avatarUrl: AVATARS[7],
      statusMood: 'Locked In',
      statusCategory: 'mood',
      verified: true,
      aboutMe: 'Business and contract law for SMB operators.',
      dealsInterestedIn: ['Retainers', 'Referrals', 'Compliance'],
      coldContactLikelihood: 'low',
    },
    {
      name: 'Tyler Brooks',
      businessName: 'Brooks Solar',
      position: 'Operations Manager',
      industryCategory: 'Energy, Utilities & Environmental',
      industry: 'Solar',
      location: 'Denver, CO',
      state: 'CO',
      zip: '80202',
      lat: 39.7392,
      lng: -104.9903,
      avatarUrl: AVATARS[8],
      statusMood: 'Open to Partnerships',
      statusCategory: 'business',
      verified: false,
      aboutMe: 'Residential and light commercial solar across Colorado.',
      dealsInterestedIn: ['Roofing partners', 'Battery add-ons', 'Referrals'],
      coldContactLikelihood: 'high',
    },
    {
      name: 'Sarah Kim',
      businessName: 'Kim Wellness',
      position: 'Specialist',
      industryCategory: 'Healthcare & Life Sciences',
      industry: 'Clinics',
      location: 'Miami, FL',
      state: 'FL',
      zip: '33130',
      lat: 25.7617,
      lng: -80.1918,
      avatarUrl: AVATARS[9],
      statusMood: 'Calm',
      statusCategory: 'mood',
      verified: true,
      aboutMe: 'Integrative wellness clinic — memberships and corporate wellness.',
      dealsInterestedIn: ['Corporate wellness', 'Referrals', 'Partnerships'],
      coldContactLikelihood: 'moderate',
    },
    {
      name: 'David Park',
      businessName: 'Park HVAC',
      position: 'Manager',
      industryCategory: 'Construction & Real Estate',
      industry: 'HVAC',
      location: 'Chicago, IL',
      state: 'IL',
      zip: '60601',
      lat: 41.8781,
      lng: -87.6298,
      avatarUrl: AVATARS[10],
      statusMood: 'Heads Down',
      statusCategory: 'business',
      verified: false,
      aboutMe: 'HVAC service and install for multi-family and light commercial.',
      dealsInterestedIn: ['Service contracts', 'GC subs', 'Referrals'],
      coldContactLikelihood: 'moderate',
    },
    {
      name: 'Amy Foster',
      businessName: 'Foster Events',
      position: 'Director',
      industryCategory: 'Food, Beverage & Hospitality',
      industry: 'Event Venues',
      location: 'Seattle, WA',
      state: 'WA',
      zip: '98101',
      lat: 47.6062,
      lng: -122.3321,
      avatarUrl: AVATARS[11],
      statusMood: 'Playful',
      statusCategory: 'mood',
      verified: true,
      aboutMe: 'Corporate events, weddings, and venue partnerships.',
      dealsInterestedIn: ['Venue blocks', 'Vendor referrals', 'Co-marketing'],
      coldContactLikelihood: 'high',
    },
  ];

  for (const e of extras) {
    list.push({
      ...e,
      id: `disc-${e.name.replace(/\s/g, '-').toLowerCase()}`,
      paychatId: `PS-${e.name.split(' ')[1]?.toUpperCase() ?? 'USER'}`,
    });
  }

  return list;
}

let catalogCache: DiscoverPerson[] | null = null;

export function discoverCatalog(): DiscoverPerson[] {
  if (!catalogCache) catalogCache = buildDiscoverCatalog();
  return catalogCache;
}

export function discoverStates(): string[] {
  const set = new Set(discoverCatalog().map((p) => p.state));
  return ['All states', ...Array.from(set).sort()];
}

export function defaultDiscoverFilters(zip = '78701'): DiscoverFilters {
  return {
    locationMode: 'radius',
    state: 'All states',
    zip,
    radiusMi: 50,
    ...defaultIndustryFilters(),
  };
}

export const RADIUS_OPTIONS_MI = [10, 25, 50, 100, 250] as const;

const ZIP_COORDS: Record<string, { lat: number; lng: number }> = {
  '78701': { lat: 30.2672, lng: -97.7431 },
  '75201': { lat: 32.7767, lng: -96.797 },
  '77002': { lat: 29.7604, lng: -95.3698 },
  '78205': { lat: 29.4241, lng: -98.4936 },
  '90210': { lat: 34.0736, lng: -118.4004 },
  '94102': { lat: 37.7749, lng: -122.4194 },
  '90012': { lat: 34.0522, lng: -118.2437 },
};

export function coordsForZip(zip: string): { lat: number; lng: number } | null {
  const key = zip.replace(/\D/g, '').slice(0, 5);
  return ZIP_COORDS[key] ?? null;
}

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type LocationFilterMode = 'state' | 'radius';

export type DiscoverFilters = {
  locationMode: LocationFilterMode;
  state: string;
  zip: string;
  radiusMi: number;
  industryCategory: string;
  industry: string;
};

export function filterDiscoverPeople(
  people: DiscoverPerson[],
  filters: DiscoverFilters
): DiscoverPerson[] {
  return filterByDiscoverFilters(people, filters);
}

export type GeoFilterable = {
  industry: string;
  industryCategory?: string;
  state: string;
  lat: number;
  lng: number;
};

/** Shared location + industry filter — Find, Edit Teams, Me network */
export function filterByDiscoverFilters<T extends GeoFilterable>(
  people: T[],
  filters: DiscoverFilters
): T[] {
  return people.filter((p) => {
    if (!matchesIndustryFilter(p, filters)) return false;

    if (filters.locationMode === 'state') {
      if (filters.state !== 'All states' && p.state !== filters.state) return false;
      return true;
    }

    const origin = coordsForZip(filters.zip);
    if (!origin) return true;
    const dist = haversineMi(origin.lat, origin.lng, p.lat, p.lng);
    return dist <= filters.radiusMi;
  });
}

export function statesFromPeople(people: { state: string }[]): string[] {
  return ['All states', ...Array.from(new Set(people.map((p) => p.state))).sort()];
}

export function findDiscoverPerson(id: string): DiscoverPerson | undefined {
  return discoverCatalog().find((p) => p.id === id);
}

const FIND_ZIP_KEY = 'ps-find-zip';

export function loadFindZip(email: string): string {
  if (typeof window === 'undefined') return '78701';
  return localStorage.getItem(`${FIND_ZIP_KEY}:${email || 'guest'}`) ?? '78701';
}

export function saveFindZip(email: string, zip: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`${FIND_ZIP_KEY}:${email || 'guest'}`, zip.replace(/\D/g, '').slice(0, 5));
  }
}
