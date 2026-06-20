import type { SessionUser } from '@/lib/types/user';
import { displayName } from '@/lib/auth-storage';
import {
  DEFAULT_COLD_CONTACT,
  type ColdContactLikelihood,
} from '@/lib/cold-contact-likelihood';
import {
  DEFAULT_BUSINESS_ADDRESS,
  DEFAULT_BUSINESS_PHONE,
} from '@/lib/profile-contact';
import { DEFAULT_PROFILE, profileForUser } from '@/lib/profile-data';

export type PersonalDetails = {
  lastName: string;
  dateOfBirth: string;
  streetAddress: string;
  unit: string;
  mobilePhone: string;
  personalEmail: string;
  city: string;
  postcode: string;
  country: string;
  state: string;
};

export type BusinessDetails = {
  countryCode: string;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  website: string;
  streetAddress: string;
  unit: string;
  city: string;
  postcode: string;
  country: string;
  state: string;
  /** How likely you are to accept cold business contact requests from Find */
  coldContactLikelihood: ColdContactLikelihood;
};

const PERSONAL_KEY = 'ps-personal-details';
const BUSINESS_KEY = 'ps-business-details';

function personalKey(email: string): string {
  return `${PERSONAL_KEY}:${email || 'guest'}`;
}

function businessKey(email: string): string {
  return `${BUSINESS_KEY}:${email || 'guest'}`;
}

export function defaultPersonalDetails(user: SessionUser | null): PersonalDetails {
  const name = displayName(user);
  const parts = name.trim().split(/\s+/);
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : 'PS marketing';
  return {
    lastName,
    dateOfBirth: '09-08-1982',
    streetAddress: '800 W El Camino Real',
    unit: 'Suite 180',
    mobilePhone: '',
    personalEmail: user?.email ?? '',
    city: 'Mountain View',
    postcode: '94040',
    country: 'United States of America',
    state: 'California',
  };
}

export function defaultBusinessDetails(user: SessionUser | null): BusinessDetails {
  const profile = profileForUser(user, DEFAULT_PROFILE);
  return {
    countryCode: '+1',
    businessName: profile.businessName || 'PinkSurfing',
    businessPhone: DEFAULT_BUSINESS_PHONE,
    businessEmail: user?.email ?? 'marketing@pinksurfing.com',
    website: 'www.pinksurfing.com',
    streetAddress: '800 W. El Camino Real',
    unit: 'Suite 180',
    city: 'Mountain View',
    postcode: '94040',
    country: 'United States of America',
    state: 'California',
    coldContactLikelihood: DEFAULT_COLD_CONTACT,
  };
}

export function loadPersonalDetails(user: SessionUser | null): PersonalDetails {
  const defaults = defaultPersonalDetails(user);
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(personalKey(user?.email ?? 'guest'));
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<PersonalDetails>) } : defaults;
  } catch {
    return defaults;
  }
}

export function savePersonalDetails(email: string, data: PersonalDetails): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(personalKey(email), JSON.stringify(data));
  }
}

export function loadBusinessDetails(user: SessionUser | null): BusinessDetails {
  const defaults = defaultBusinessDetails(user);
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(businessKey(user?.email ?? 'guest'));
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<BusinessDetails>) } : defaults;
  } catch {
    return defaults;
  }
}

export function saveBusinessDetails(email: string, data: BusinessDetails): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(businessKey(email), JSON.stringify(data));
  }
}

export function formatBusinessAddress(d: BusinessDetails): string {
  const line2 = d.unit ? `, ${d.unit}` : '';
  return `${d.streetAddress}${line2}, ${d.city}, ${d.state} ${d.postcode}`;
}

export function formatPersonalAddress(d: PersonalDetails): string {
  const line2 = d.unit ? `, ${d.unit}` : '';
  return `${d.streetAddress}${line2}, ${d.city}, ${d.state} ${d.postcode}`;
}

/** Fallback when business details not fully filled */
export { DEFAULT_BUSINESS_ADDRESS };
