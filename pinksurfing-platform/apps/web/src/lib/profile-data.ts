import type { SessionUser } from '@/lib/types/user';
import { categoryForIndustry } from '@/lib/industry-taxonomy';

export type ProfileFields = {
  position: string;
  industryCategory: string;
  industry: string;
  location: string;
  status: string;
  affiliation: string;
  businessName: string;
};

export type NetworkPerson = {
  id: string;
  name: string;
  line: 'first' | 'second';
  industryCategory: string;
  industry: string;
  location: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  avatarUrl: string;
};

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  vip?: boolean;
};

export const DEFAULT_PROFILE: ProfileFields = {
  position: 'Product Designer',
  industryCategory: 'Construction & Real Estate',
  industry: 'Painting',
  location: 'Austin, TX',
  status: 'Available for projects',
  affiliation: 'PinkSurfing Pro',
  businessName: 'Surf Design Co.',
};

const AVATAR =
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&h=120&fit=crop';

export const NETWORK_FIRST_LINE: NetworkPerson[] = [
  {
    id: 'n1',
    name: 'Ace',
    line: 'first',
    industryCategory: 'Construction & Real Estate',
    industry: 'General Contracting',
    location: 'Austin, TX',
    state: 'TX',
    zip: '78701',
    lat: 30.2672,
    lng: -97.7431,
    avatarUrl: AVATAR,
  },
  {
    id: 'n2',
    name: 'Spade',
    line: 'first',
    industryCategory: 'Energy, Utilities & Environmental',
    industry: 'Solar',
    location: 'Dallas, TX',
    state: 'TX',
    zip: '75201',
    lat: 32.7767,
    lng: -96.797,
    avatarUrl: AVATAR,
  },
  {
    id: 'n3',
    name: 'Cherry',
    line: 'first',
    industryCategory: 'Construction & Real Estate',
    industry: 'Painting',
    location: 'Austin, TX',
    state: 'TX',
    zip: '78701',
    lat: 30.2672,
    lng: -97.7431,
    avatarUrl: AVATAR,
  },
  {
    id: 'n4',
    name: 'Blade',
    line: 'first',
    industryCategory: 'Healthcare & Life Sciences',
    industry: 'Clinics',
    location: 'Houston, TX',
    state: 'TX',
    zip: '77002',
    lat: 29.7604,
    lng: -95.3698,
    avatarUrl: AVATAR,
  },
  {
    id: 'n5',
    name: 'Demon',
    line: 'first',
    industryCategory: 'Energy, Utilities & Environmental',
    industry: 'Solar',
    location: 'Austin, TX',
    state: 'TX',
    zip: '78701',
    lat: 30.2672,
    lng: -97.7431,
    avatarUrl: AVATAR,
  },
];

export const NETWORK_SECOND_LINE: NetworkPerson[] = [
  {
    id: 'n6',
    name: 'Devil',
    line: 'second',
    industryCategory: 'Construction & Real Estate',
    industry: 'Remodeling & Renovation',
    location: 'San Antonio, TX',
    state: 'TX',
    zip: '78205',
    lat: 29.4241,
    lng: -98.4936,
    avatarUrl: AVATAR,
  },
  {
    id: 'n7',
    name: 'Nova',
    line: 'second',
    industryCategory: 'Healthcare & Life Sciences',
    industry: 'Clinics',
    location: 'Dallas, TX',
    state: 'TX',
    zip: '75201',
    lat: 32.7767,
    lng: -96.797,
    avatarUrl: AVATAR,
  },
  {
    id: 'n8',
    name: 'Echo',
    line: 'second',
    industryCategory: 'Construction & Real Estate',
    industry: 'HVAC',
    location: 'Austin, TX',
    state: 'TX',
    zip: '78701',
    lat: 30.2672,
    lng: -97.7431,
    avatarUrl: AVATAR,
  },
  {
    id: 'n9',
    name: 'Rook',
    line: 'second',
    industryCategory: 'Media, Entertainment & Creative',
    industry: 'Graphic Design',
    location: 'Austin, TX',
    state: 'TX',
    zip: '78701',
    lat: 30.2672,
    lng: -97.7431,
    avatarUrl: AVATAR,
  },
  {
    id: 'n10',
    name: 'Jade',
    line: 'second',
    industryCategory: 'Finance, Insurance & Professional Services',
    industry: 'Legal Services',
    location: 'Houston, TX',
    state: 'TX',
    zip: '77002',
    lat: 29.7604,
    lng: -95.3698,
    avatarUrl: AVATAR,
  },
];

export const DEMO_NETWORK: NetworkPerson[] = [
  ...NETWORK_FIRST_LINE,
  ...NETWORK_SECOND_LINE,
];

export const DEMO_TEAM: TeamMember[] = [
  { id: 't1', name: 'Scarlett J.', role: 'Lead', vip: true },
  { id: 't2', name: 'Michael A.', role: 'Contractor' },
  { id: 't3', name: 'Sarah K.', role: 'PayChat', vip: true },
  { id: 't4', name: 'Alex D.', role: 'Member' },
  { id: 't5', name: 'David C.', role: 'Member' },
  { id: 't6', name: 'You', role: 'Owner', vip: true },
];

export function profileForUser(user: SessionUser | null, fields = DEFAULT_PROFILE): ProfileFields {
  if (!user) return fields;
  return {
    ...fields,
    affiliation: user.pspayId ? `PS Pay · ${user.pspayId}` : fields.affiliation,
    businessName: user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : fields.businessName,
  };
}
