import type { SessionUser } from '@/lib/types/user';
import type { NetworkPerson } from '@/lib/profile-data';
import { DEFAULT_PROFILE, NETWORK_FIRST_LINE, NETWORK_SECOND_LINE, profileForUser } from '@/lib/profile-data';
import { displayName } from '@/lib/auth-storage';
import type { ColdContactLikelihood } from '@/lib/cold-contact-likelihood';
import {
  DEFAULT_BUSINESS_ADDRESS,
  DEFAULT_BUSINESS_PHONE,
} from '@/lib/profile-contact';

import { categoryForIndustry } from '@/lib/industry-taxonomy';
import { withBasePath } from '@/lib/base-path';
import { loadBusinessDetails } from '@/lib/profile-settings-storage';

function profileAvatarUrl(user: SessionUser | null): string | undefined {
  const u = user as SessionUser & { avatarUrl?: string };
  return u?.avatarUrl;
}

function businessLogoUrl(user: SessionUser | null): string | undefined {
  const u = user as SessionUser & { businessLogoUrl?: string };
  return u?.businessLogoUrl;
}

export type BusinessStoreLink =
  | { type: 'pinksurfing'; url: string; label: string }
  | { type: 'external'; url: string; label: string }
  | { type: 'none' };

export type BusinessProfileData = {
  contactId: string;
  name: string;
  credentials?: string;
  position: string;
  industryCategory: string;
  industry: string;
  location: string;
  status: string;
  avatarUrl: string;
  businessLogoUrl?: string;
  businessName?: string;
  store: BusinessStoreLink;
  phone: string;
  email: string;
  address: string;
  inviteCode: string;
  aboutMe: string;
  dealsInterestedIn: string[];
  coldContactLikelihood: ColdContactLikelihood;
  firstLine: NetworkPerson[];
  secondLine: NetworkPerson[];
};

const AVATAR =
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=320&h=320&fit=crop';

export const DEMO_BUSINESS_PROFILES: Record<string, BusinessProfileData> = {
  c3: {
    contactId: 'c3',
    name: 'Scarlett Jenner',
    credentials: 'MD',
    position: 'Project Lead',
    industryCategory: 'Construction & Real Estate',
    industry: 'Painting',
    location: 'Austin, TX',
    status: 'Available for exterior work',
    avatarUrl: AVATAR,
    businessName: 'Surf Exterior Co.',
    store: {
      type: 'pinksurfing',
      url: 'https://pinksurfing.com/shop',
      label: 'Surf Exterior Co. on PinkSurfing',
    },
    phone: '5125550198',
    email: 'scarlett@surfdesign.example',
    address: '1200 Congress Ave, Austin, TX 78701',
    inviteCode: 'PAINT-2024',
    aboutMe: 'Exterior specialist focused on commercial repaint and stucco repair in the Bay Area.',
    dealsInterestedIn: ['Commercial repaint', 'HOA exterior bids', 'Referral partnerships'],
    coldContactLikelihood: 'low',
    firstLine: NETWORK_FIRST_LINE,
    secondLine: NETWORK_SECOND_LINE,
  },
  c4: {
    contactId: 'c4',
    name: 'Michael Adams',
    position: 'Operations Manager',
    industryCategory: 'Energy, Utilities & Environmental',
    industry: 'Solar',
    location: 'Dallas, TX',
    status: 'Scheduling site surveys',
    avatarUrl: AVATAR,
    businessName: 'Solar Install Co.',
    store: {
      type: 'external',
      url: 'https://solarinstall.example',
      label: 'Solar Install Co. (external store)',
    },
    phone: '2145550144',
    email: 'michael@solarinstall.example',
    address: '500 Main St, Dallas, TX 75201',
    inviteCode: 'SOLAR-24',
    aboutMe: 'Scaling residential solar installs — looking for roofing partners and qualified installers.',
    dealsInterestedIn: ['Roofing referrals', 'Battery add-ons', 'Commercial solar'],
    coldContactLikelihood: 'high',
    firstLine: NETWORK_FIRST_LINE.slice(0, 4),
    secondLine: NETWORK_SECOND_LINE,
  },
  c5: {
    contactId: 'c5',
    name: 'Alex Doins',
    credentials: 'JD',
    position: 'General Contractor',
    industryCategory: 'Construction & Real Estate',
    industry: 'General Contracting',
    location: 'Houston, TX',
    status: 'Resolving active dispute',
    avatarUrl: AVATAR,
    businessName: 'Deck Masters',
    store: { type: 'none' },
    phone: '7135550177',
    email: 'alex@deckmasters.example',
    address: '900 Westheimer Rd, Houston, TX 77006',
    inviteCode: 'DECK-BUILD',
    aboutMe: 'Deck & outdoor living contractor — currently booking Q3 builds.',
    dealsInterestedIn: ['Composite decking', 'Pergola installs', 'Landscape trades'],
    coldContactLikelihood: 'moderate',
    firstLine: NETWORK_FIRST_LINE.slice(0, 3),
    secondLine: NETWORK_SECOND_LINE.slice(0, 3),
  },
};

export function businessProfileForContact(contactId: string): BusinessProfileData | null {
  return DEMO_BUSINESS_PROFILES[contactId] ?? null;
}

export function businessProfileForUser(user: SessionUser | null): BusinessProfileData {
  const profile = profileForUser(user, DEFAULT_PROFILE);
  const name = displayName(user) || profile.businessName;
  const email = user?.email ?? 'billing@pinksurfing.com';
  const inviteCode = email ? email.split('@')[0].toUpperCase().slice(0, 12) : 'PS-DEMO';

  const biz = loadBusinessDetails(user);

  return {
    contactId: 'me',
    name,
    credentials: 'MD',
    position: profile.position,
    industryCategory:
      profile.industryCategory ??
      categoryForIndustry(profile.industry) ??
      'Construction & Real Estate',
    industry: profile.industry,
    location: profile.location,
    status: profile.status,
    avatarUrl: profileAvatarUrl(user) ?? AVATAR,
    businessLogoUrl: businessLogoUrl(user) || withBasePath('/nav/explore.png'),
    businessName: profile.businessName,
    store: { type: 'none' },
    phone: DEFAULT_BUSINESS_PHONE,
    email,
    address: DEFAULT_BUSINESS_ADDRESS,
    inviteCode,
    aboutMe: `${profile.status} — ${profile.position} in ${profile.industry}.`,
    dealsInterestedIn: [
      profile.industry,
      'PinkSurfing network intros',
      'Contractor referrals',
    ].filter((v, i, a) => a.indexOf(v) === i),
    coldContactLikelihood: biz.coldContactLikelihood,
    firstLine: NETWORK_FIRST_LINE,
    secondLine: NETWORK_SECOND_LINE,
  };
}

export function storeMessage(store: BusinessStoreLink): string {
  if (store.type === 'none') return 'This person does not yet have a store on PinkSurfing';
  if (store.type === 'external') return `${store.label} — external store`;
  return store.label;
}

export function gmailComposeUrl(email: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
}

export function telUrl(phone: string): string {
  return `tel:${phone.replace(/\D/g, '')}`;
}

export function mapsDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
