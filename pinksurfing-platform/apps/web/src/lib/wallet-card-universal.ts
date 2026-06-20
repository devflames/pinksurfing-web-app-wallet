import type { CardTypeDef, WalletCardRecord } from '@/lib/wallet-card-types';
import type { WalletCardCategory } from '@/lib/wallet-cards-storage';

export type WalletCardCategoryTag =
  | 'insurance'
  | 'membership'
  | 'loyalty'
  | 'access'
  | 'gift_card'
  | 'health'
  | 'professional'
  | 'other';

export type WalletCardUniversal = {
  nickname: string;
  category: WalletCardCategoryTag;
  frontPhoto: string;
  backPhoto: string;
  barcodeData: string;
  memberNumber: string;
  expirationDate: string;
  renewalReminder: boolean;
  notesToSelf: string;
  useInstructions: string;
  sharedWithFamily: boolean;
  sharedWithNames: string;
  isPrivate: boolean;
};

export const WALLET_CATEGORY_OPTIONS: { value: WalletCardCategoryTag; label: string }[] = [
  { value: 'insurance', label: 'Insurance' },
  { value: 'membership', label: 'Membership' },
  { value: 'loyalty', label: 'Loyalty' },
  { value: 'access', label: 'Access' },
  { value: 'gift_card', label: 'Gift card' },
  { value: 'health', label: 'Health' },
  { value: 'professional', label: 'Professional' },
  { value: 'other', label: 'Other' },
];

const MEMBER_KEYS = [
  'memberId',
  'membershipNumber',
  'memberNumber',
  'cardNumber',
  'policyNumber',
  'rxMemberId',
  'loyaltyNumber',
  'rewardsNumber',
  'studentId',
  'employeeId',
  'passNumber',
  'licenseNumber',
];

export function emptyUniversal(typeDef?: CardTypeDef): WalletCardUniversal {
  return {
    nickname: typeDef?.label ?? '',
    category: typeDef ? defaultCategoryForType(typeDef.id) : 'other',
    frontPhoto: '',
    backPhoto: '',
    barcodeData: '',
    memberNumber: '',
    expirationDate: '',
    renewalReminder: true,
    notesToSelf: '',
    useInstructions: '',
    sharedWithFamily: false,
    sharedWithNames: '',
    isPrivate: false,
  };
}

export function defaultCategoryForType(typeId: string): WalletCardCategoryTag {
  if (typeId.includes('insurance') || typeId === 'aaa' || typeId === 'hsa_fsa') return 'insurance';
  if (typeId === 'costco' || typeId === 'sams_bjs' || typeId === 'gym' || typeId === 'library') return 'membership';
  if (
    typeId.includes('loyalty') ||
    typeId === 'grocery_rewards' ||
    typeId === 'gas_rewards' ||
    typeId === 'loyalty_punch'
  )
    return 'loyalty';
  if (
    typeId === 'employee_badge' ||
    typeId === 'building_access' ||
    typeId === 'parking' ||
    typeId === 'student_id' ||
    typeId === 'transit'
  )
    return 'access';
  if (typeId === 'gift_card') return 'gift_card';
  if (typeId === 'covid_vaccine' || typeId === 'immunization' || typeId === 'medical_insurance' || typeId === 'vision_dental')
    return 'health';
  if (typeId === 'pharmacy' || typeId === 'rx_discount') return 'health';
  return 'other';
}

export function defaultCategoryForPanel(panel: WalletCardCategory): WalletCardCategoryTag {
  if (panel === 'health') return 'health';
  if (panel === 'professional') return 'professional';
  return 'other';
}

function inferMemberNumber(fields: Record<string, string>, typeDef?: CardTypeDef): string {
  if (typeDef?.subtitleKey && fields[typeDef.subtitleKey]) return fields[typeDef.subtitleKey];
  for (const key of MEMBER_KEYS) {
    if (fields[key]?.trim()) return fields[key];
  }
  return '';
}

function inferBarcode(fields: Record<string, string>, memberNumber: string): string {
  if (memberNumber) return memberNumber;
  return (
    fields.membershipNumber ||
    fields.rewardsNumber ||
    fields.cardNumber ||
    fields.loyaltyNumber ||
    fields.rxMemberId ||
    ''
  );
}

export function inferUseInstructions(_typeId: string, fields: Record<string, string>): string {
  return fields.accessInstructions || fields.eligibleUseNotes || '';
}

/** Keys handled by universal fields — hide from type-specific form */
export const UNIVERSAL_OVERLAP_KEYS = new Set([
  'photoFront',
  'photoBack',
  'expirationDate',
  'notes',
]);

export function typeSpecificFields(typeDef: CardTypeDef): CardTypeDef['fields'] {
  return typeDef.fields.filter((f) => !UNIVERSAL_OVERLAP_KEYS.has(f.key));
}

export function migrateWalletCard(
  card: WalletCardRecord,
  typeDef?: CardTypeDef,
  panel?: WalletCardCategory
): WalletCardRecord {
  if (card.universal) {
    return {
      ...card,
      label: card.universal.nickname || card.label,
      expirationDate: card.universal.expirationDate || card.expirationDate,
    };
  }

  const memberNumber = inferMemberNumber(card.fields, typeDef);
  const expirationDate = card.expirationDate || card.fields.expirationDate || '';
  const universal: WalletCardUniversal = {
    nickname: card.label || typeDef?.label || '',
    category: typeDef ? defaultCategoryForType(typeDef.id) : panel ? defaultCategoryForPanel(panel) : 'other',
    frontPhoto: card.fields.photoFront || '',
    backPhoto: card.fields.photoBack || '',
    barcodeData: inferBarcode(card.fields, memberNumber),
    memberNumber,
    expirationDate,
    renewalReminder: true,
    notesToSelf: card.fields.notes || '',
    useInstructions: inferUseInstructions(card.type, card.fields),
    sharedWithFamily: false,
    sharedWithNames: '',
    isPrivate: false,
  };

  return {
    ...card,
    label: universal.nickname,
    expirationDate: universal.expirationDate,
    universal,
  };
}

export function syncCardFromUniversal(
  card: WalletCardRecord,
  universal: WalletCardUniversal,
  typeDef?: CardTypeDef
): WalletCardRecord {
  const fields = { ...card.fields };
  if (universal.expirationDate) fields.expirationDate = universal.expirationDate;
  if (universal.frontPhoto) fields.photoFront = universal.frontPhoto;
  if (universal.backPhoto) fields.photoBack = universal.backPhoto;
  if (universal.notesToSelf) fields.notes = universal.notesToSelf;

  const memberKey = typeDef?.subtitleKey;
  if (memberKey && universal.memberNumber) fields[memberKey] = universal.memberNumber;

  return {
    ...card,
    label: universal.nickname.trim() || card.label,
    expirationDate: universal.expirationDate,
    universal,
    fields,
  };
}

export function recordExpirationUniversal(record: WalletCardRecord): string {
  return (
    record.universal?.expirationDate ||
    record.expirationDate ||
    record.fields.expirationDate ||
    record.fields.coverageEnd ||
    ''
  );
}

export function displayNickname(record: WalletCardRecord, typeDef?: CardTypeDef): string {
  return record.universal?.nickname?.trim() || record.label || typeDef?.label || 'Card';
}

function fieldDisplayValue(typeDef: CardTypeDef, key: string, raw: string): string {
  const field = typeDef.fields.find((f) => f.key === key);
  if (field?.kind === 'select' && field.options) {
    return field.options.find((o) => o.value === raw)?.label ?? raw;
  }
  return raw;
}

/** Brand / issuer line under the card type header in list & detail views */
export function displayCardSubtitle(record: WalletCardRecord, typeDef?: CardTypeDef): string {
  if (typeDef?.subtitleKey) {
    const raw = record.fields[typeDef.subtitleKey]?.trim();
    if (raw) return fieldDisplayValue(typeDef, typeDef.subtitleKey, raw);
  }
  const nickname = displayNickname(record, typeDef);
  const label = typeDef?.label ?? '';
  if (nickname && nickname !== label) return nickname;
  return '';
}

export function frontPhoto(record: WalletCardRecord): string {
  return record.universal?.frontPhoto || record.fields.photoFront || '';
}

export function initialUniversalForType(typeId: string, typeDef?: CardTypeDef, panel?: WalletCardCategory): WalletCardUniversal {
  const u = emptyUniversal(typeDef);
  u.category = typeDef ? defaultCategoryForType(typeId) : panel ? defaultCategoryForPanel(panel) : 'other';
  return u;
}
