import type { SessionUser } from '@/lib/types/user';
import { DEFAULT_PROFILE, profileForUser } from '@/lib/profile-data';
import { displayName } from '@/lib/auth-storage';

export const DEFAULT_BUSINESS_PHONE = '7145194674';
export const DEFAULT_BUSINESS_ADDRESS =
  '800 W. El Camino Real, Suite 180, Mountain View, CA 94040';

export type InvoiceSender = {
  name: string;
  position: string;
  address: string;
  phone: string;
  email: string;
};

export function invoiceSenderForUser(user: SessionUser | null): InvoiceSender {
  const profile = profileForUser(user, DEFAULT_PROFILE);
  const name = displayName(user) || profile.businessName;
  return {
    name,
    position: profile.position,
    address: profile.location.includes(',') && profile.location.length > 12
      ? profile.location
      : DEFAULT_BUSINESS_ADDRESS,
    phone: DEFAULT_BUSINESS_PHONE,
    email: user?.email ?? 'billing@pinksurfing.com',
  };
}
