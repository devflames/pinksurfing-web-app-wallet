import { DEMO_BUSINESS_PROFILES } from '@/lib/business-profile-data';
import {
  ALL_CATEGORIES,
  ALL_INDUSTRIES,
} from '@/lib/industry-taxonomy';
import {
  filterByDiscoverFilters,
  statesFromPeople,
  type DiscoverFilters,
} from '@/lib/discover-people';

export type DirectoryBusiness = {
  id: string;
  businessName: string;
  contactName: string;
  industryCategory: string;
  industry: string;
  location: string;
  state: string;
  lat: number;
  lng: number;
  paychatId: string;
  /** Existing demo contact id when already on platform */
  contactId?: string;
};

const LOCATION_GEO: Record<string, { state: string; lat: number; lng: number }> = {
  'Austin, TX': { state: 'TX', lat: 30.2672, lng: -97.7431 },
  'Dallas, TX': { state: 'TX', lat: 32.7767, lng: -96.797 },
  'Houston, TX': { state: 'TX', lat: 29.7604, lng: -95.3698 },
  'San Francisco, CA': { state: 'CA', lat: 37.7749, lng: -122.4194 },
};

function geoForLocation(location: string) {
  return LOCATION_GEO[location] ?? { state: 'TX', lat: 30.27, lng: -97.74 };
}

function withGeo(entry: Omit<DirectoryBusiness, 'state' | 'lat' | 'lng'>): DirectoryBusiness {
  const g = geoForLocation(entry.location);
  return { ...entry, state: g.state, lat: g.lat, lng: g.lng };
}

const EXTRA_DIRECTORY: DirectoryBusiness[] = [
  withGeo({
    id: 'dir-hvac',
    businessName: 'CoolAir HVAC',
    contactName: 'Rita Nguyen',
    industryCategory: 'Construction & Real Estate',
    industry: 'HVAC',
    location: 'Houston, TX',
    paychatId: 'PS-COOLAIR',
  }),
  withGeo({
    id: 'dir-legal',
    businessName: 'Bay Legal Group',
    contactName: 'Chris Palmer',
    industryCategory: 'Finance, Insurance & Professional Services',
    industry: 'Legal Services',
    location: 'San Francisco, CA',
    paychatId: 'PS-BAYLEGAL',
  }),
  withGeo({
    id: 'dir-design',
    businessName: 'Pixel Studio',
    contactName: 'Sam Ortiz',
    industryCategory: 'Media, Entertainment & Creative',
    industry: 'Graphic Design',
    location: 'Austin, TX',
    paychatId: 'PS-PIXEL',
  }),
  withGeo({
    id: 'dir-health',
    businessName: 'WellPath Clinic',
    contactName: 'Dr. Nina Shah',
    industryCategory: 'Healthcare & Life Sciences',
    industry: 'Clinics',
    location: 'Dallas, TX',
    paychatId: 'PS-WELLPATH',
  }),
];

function fromProfiles(): DirectoryBusiness[] {
  return Object.values(DEMO_BUSINESS_PROFILES).map((p) =>
    withGeo({
      id: p.contactId,
      businessName: p.businessName ?? p.name,
      contactName: p.name,
      industryCategory: p.industryCategory,
      industry: p.industry,
      location: p.location,
      paychatId: `PS-${p.inviteCode.replace(/[^A-Z0-9]/gi, '').slice(0, 10)}`,
      contactId: p.contactId,
    })
  );
}

export function allDirectoryBusinesses(): DirectoryBusiness[] {
  const fromDemo = fromProfiles();
  const seen = new Set(fromDemo.map((b) => b.id));
  return [...fromDemo, ...EXTRA_DIRECTORY.filter((b) => !seen.has(b.id))];
}

export function filterDirectory(
  query: string,
  industryCategory: string,
  industry: string
): DirectoryBusiness[] {
  return filterDirectoryByFilters(query, {
    locationMode: 'radius',
    state: 'All states',
    zip: '78701',
    radiusMi: 250,
    industryCategory: industryCategory || ALL_CATEGORIES,
    industry: industry || ALL_INDUSTRIES,
  });
}

export function filterDirectoryByFilters(
  query: string,
  filters: DiscoverFilters
): DirectoryBusiness[] {
  const q = query.trim().toLowerCase();
  const list = filterByDiscoverFilters(allDirectoryBusinesses(), filters);
  if (!q) return list;
  return list.filter(
    (b) =>
      b.businessName.toLowerCase().includes(q) ||
      b.contactName.toLowerCase().includes(q) ||
      b.industry.toLowerCase().includes(q) ||
      b.industryCategory.toLowerCase().includes(q) ||
      b.location.toLowerCase().includes(q)
  );
}

export function directoryStates(): string[] {
  return statesFromPeople(allDirectoryBusinesses());
}

export function findDirectoryBusiness(id: string): DirectoryBusiness | undefined {
  return allDirectoryBusinesses().find((b) => b.id === id);
}
