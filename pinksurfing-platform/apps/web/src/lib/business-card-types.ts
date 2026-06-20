import type { BusinessStoreLink } from '@/lib/business-profile-data';
import type { BusinessProfileData } from '@/lib/business-profile-data';
import {
  formatBusinessAddress,
  loadBusinessDetails,
} from '@/lib/profile-settings-storage';

export type BusinessCardSnapshot = {
  contactId: string;
  name: string;
  credentials?: string;
  displayName: string;
  address: string;
  phone: string;
  email: string;
  inviteCode: string;
  businessLogoUrl?: string;
  avatarUrl?: string;
  aboutMe?: string;
  dealsInterestedIn?: string[];
  store?: BusinessStoreLink;
};

export const PINKSURFING_APP_URL = 'https://pinksurfing.com/app';
export const PINKSURFING_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.pinksurfing.app';
export const PINKSURFING_APP_STORE_URL = 'https://apps.apple.com/app/pinksurfing/id000000000';

/** Demo: business chat contacts in your 1st line — share allowed */
export const FIRST_LINE_BUSINESS_CONTACT_IDS = new Set(['c3', 'c4', 'me']);

export function snapshotFromProfile(
  profile: BusinessProfileData,
  user?: import('@/lib/types/user').SessionUser | null
): BusinessCardSnapshot {
  const biz = user ? loadBusinessDetails(user) : null;
  return {
    contactId: profile.contactId,
    name: profile.name,
    credentials: profile.credentials,
    displayName: biz?.businessName || profile.businessName || profile.name,
    address: biz ? formatBusinessAddress(biz) : profile.address,
    phone: biz?.businessPhone ?? profile.phone,
    email: biz?.businessEmail ?? profile.email,
    inviteCode: profile.inviteCode,
    businessLogoUrl: profile.businessLogoUrl,
    avatarUrl: profile.avatarUrl,
    aboutMe: profile.aboutMe,
    dealsInterestedIn: profile.dealsInterestedIn,
    store: profile.store,
  };
}

export function canShareBusinessCard(contactId: string): boolean {
  return FIRST_LINE_BUSINESS_CONTACT_IDS.has(contactId);
}

export function cardDisplayTitle(card: BusinessCardSnapshot): string {
  return card.credentials ? `${card.displayName} ${card.credentials}` : card.displayName;
}
