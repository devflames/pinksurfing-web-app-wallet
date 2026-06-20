export type FieldKind = 'text' | 'date' | 'tel' | 'email' | 'url' | 'password' | 'textarea' | 'select' | 'photo';

export type FieldDef = {
  key: string;
  label: string;
  kind?: FieldKind;
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
};

import type { WalletCardUniversal } from '@/lib/wallet-card-universal';

export type WalletCardRecord = {
  id: string;
  type: string;
  label: string;
  expirationDate: string;
  fields: Record<string, string>;
  universal?: WalletCardUniversal;
  createdAt: string;
  updatedAt: string;
};

export type CardTypeDef = {
  id: string;
  label: string;
  fields: FieldDef[];
  /** Primary field used for list subtitle */
  subtitleKey?: string;
};

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
  'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY', 'DC',
].map((s) => ({ value: s, label: s }));

export const COVID_VACCINE_PORTALS: Record<string, { label: string; url: string; note: string }> = {
  CA: {
    label: 'California Digital Vaccine Record',
    url: 'https://myvaccinerecord.cdph.ca.gov/request',
    note: 'California only. Request your record, then access it with the PIN CDPH emails you.',
  },
};

export const HEALTH_CARD_TYPES: CardTypeDef[] = [
  {
    id: 'covid_vaccine',
    label: 'COVID Vaccine Card',
    subtitleKey: 'vaccinationState',
    fields: [
      { key: 'vaccinationState', label: 'Vaccination state', kind: 'select', options: US_STATES, required: true },
      { key: 'portalPin', label: 'Portal PIN (stored locally)', kind: 'password', placeholder: 'PIN from state portal email' },
      { key: 'memberName', label: 'Name on record', required: true },
      { key: 'doseInfo', label: 'Doses / lot numbers', kind: 'textarea', placeholder: 'e.g. Pfizer dose 1 — 2021-03-12' },
      { key: 'expirationDate', label: 'Record / booster due date', kind: 'date' },
      { key: 'notes', label: 'Notes', kind: 'textarea' },
      { key: 'photoFront', label: 'Card photo', kind: 'photo' },
    ],
  },
  {
    id: 'immunization',
    label: 'Immunization Card',
    subtitleKey: 'issuer',
    fields: [
      { key: 'issuer', label: 'Issuer / clinic', required: true },
      { key: 'memberName', label: 'Patient name', required: true },
      { key: 'immunizations', label: 'Immunizations', kind: 'textarea', placeholder: 'MMR, Tdap, Hep B…' },
      { key: 'expirationDate', label: 'Expiration / review date', kind: 'date', required: true },
      { key: 'notes', label: 'Notes', kind: 'textarea' },
      { key: 'photoFront', label: 'Card photo', kind: 'photo' },
    ],
  },
  {
    id: 'medical_insurance',
    label: 'Medical Insurance',
    subtitleKey: 'insuranceCompany',
    fields: [
      { key: 'insuranceCompany', label: 'Insurance company', required: true },
      { key: 'memberId', label: 'Member ID', required: true },
      { key: 'groupNumber', label: 'Group number' },
      { key: 'planName', label: 'Plan name' },
      { key: 'subscriberName', label: 'Subscriber name' },
      { key: 'phone', label: 'Member services phone', kind: 'tel' },
      { key: 'expirationDate', label: 'Coverage end date', kind: 'date', required: true },
      { key: 'notes', label: 'Notes', kind: 'textarea' },
      { key: 'photoFront', label: 'Card front', kind: 'photo' },
      { key: 'photoBack', label: 'Card back', kind: 'photo' },
    ],
  },
  {
    id: 'vision_dental',
    label: 'Vision & Dental',
    subtitleKey: 'provider',
    fields: [
      { key: 'provider', label: 'Provider / carrier', required: true },
      { key: 'visionMemberId', label: 'Vision member ID' },
      { key: 'dentalMemberId', label: 'Dental member ID' },
      { key: 'subscriberName', label: 'Subscriber name' },
      { key: 'phone', label: 'Support phone', kind: 'tel' },
      { key: 'expirationDate', label: 'Coverage end date', kind: 'date', required: true },
      { key: 'notes', label: 'Notes', kind: 'textarea' },
      { key: 'photoFront', label: 'Card photo', kind: 'photo' },
    ],
  },
];

export const PROFESSIONAL_LICENSE_TYPES: CardTypeDef[] = [
  { id: 'md', label: 'Medical Doctor (MD)', fields: [{ key: 'licenseNumber', label: 'License number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'do', label: 'Doctor of Osteopathic Medicine (DO)', fields: [{ key: 'licenseNumber', label: 'License number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'rn', label: 'Registered Nurse (RN)', fields: [{ key: 'licenseNumber', label: 'License number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'np', label: 'Nurse Practitioner (NP)', fields: [{ key: 'licenseNumber', label: 'License number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'pa', label: 'Physician Assistant (PA)', fields: [{ key: 'licenseNumber', label: 'License number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'pharmd', label: 'Pharmacist (PharmD)', fields: [{ key: 'licenseNumber', label: 'License number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'dds', label: 'Dentist (DDS/DMD)', fields: [{ key: 'licenseNumber', label: 'License number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'jd', label: 'Attorney (Bar)', fields: [{ key: 'licenseNumber', label: 'Bar number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'Bar card photo', kind: 'photo' }] },
  { id: 'cpa', label: 'CPA', fields: [{ key: 'licenseNumber', label: 'License number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'pe', label: 'Professional Engineer (PE)', fields: [{ key: 'licenseNumber', label: 'License number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'architect', label: 'Architect', fields: [{ key: 'licenseNumber', label: 'License number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'contractor', label: 'General Contractor', fields: [{ key: 'licenseNumber', label: 'License number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'real_estate', label: 'Real Estate Agent/Broker', fields: [{ key: 'licenseNumber', label: 'License number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'insurance_agent', label: 'Insurance Agent', fields: [{ key: 'licenseNumber', label: 'License number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'pilot', label: 'Pilot (FAA)', fields: [{ key: 'licenseNumber', label: 'Certificate number', required: true }, { key: 'state', label: 'State of issue', kind: 'select', options: US_STATES }, { key: 'expirationDate', label: 'Medical / cert expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'Certificate photo', kind: 'photo' }] },
  { id: 'cdl', label: 'Commercial Driver (CDL)', fields: [{ key: 'licenseNumber', label: 'CDL number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Endorsements / notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'teaching', label: 'Teaching Credential', fields: [{ key: 'licenseNumber', label: 'Credential number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'Credential photo', kind: 'photo' }] },
  { id: 'cosmetology', label: 'Cosmetology / Barber', fields: [{ key: 'licenseNumber', label: 'License number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES, required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'License photo', kind: 'photo' }] },
  { id: 'health_insurance_license', label: 'Health Insurance (policy)', subtitleKey: 'insuranceCompany', fields: [{ key: 'insuranceCompany', label: 'Insurance company', required: true }, { key: 'policyNumber', label: 'Policy number', required: true }, { key: 'state', label: 'State', kind: 'select', options: US_STATES }, { key: 'expirationDate', label: 'Coverage end date', kind: 'date', required: true }, { key: 'agentPhone', label: 'Agent phone', kind: 'tel' }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'Card photo', kind: 'photo' }] },
  { id: 'auto_insurance', label: 'Auto Insurance', subtitleKey: 'insuranceCompany', fields: [{ key: 'insuranceCompany', label: 'Insurance company', required: true }, { key: 'policyNumber', label: 'Policy number', required: true }, { key: 'insuredVehicle', label: 'Insured vehicle' }, { key: 'state', label: 'State', kind: 'select', options: US_STATES }, { key: 'expirationDate', label: 'Coverage end date', kind: 'date', required: true }, { key: 'agentPhone', label: 'Agent phone', kind: 'tel' }, { key: 'claimsPhone', label: 'Claims phone', kind: 'tel' }, { key: 'notes', label: 'Notes', kind: 'textarea' }, { key: 'photoFront', label: 'Card front', kind: 'photo' }, { key: 'photoBack', label: 'Card back', kind: 'photo' }] },
];

export const MISC_CARD_TYPES: CardTypeDef[] = [
  { id: 'auto_insurance_card', label: 'Auto Insurance Card', subtitleKey: 'insuranceCompany', fields: [{ key: 'insuranceCompany', label: 'Insurance company', required: true }, { key: 'policyNumber', label: 'Policy number', required: true }, { key: 'insuredVehicle', label: 'Insured vehicle' }, { key: 'coverageStart', label: 'Coverage start', kind: 'date' }, { key: 'expirationDate', label: 'Coverage end', kind: 'date', required: true }, { key: 'agentPhone', label: 'Agent phone', kind: 'tel' }, { key: 'claimsPhone', label: 'Claims phone', kind: 'tel' }, { key: 'roadsidePhone', label: 'Roadside number', kind: 'tel' }, { key: 'photoFront', label: 'Card front', kind: 'photo' }, { key: 'photoBack', label: 'Card back', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'aaa', label: 'AAA Membership', subtitleKey: 'membershipNumber', fields: [{ key: 'memberName', label: 'Member name', required: true }, { key: 'membershipNumber', label: 'Membership number', required: true }, { key: 'membershipLevel', label: 'Membership level' }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'roadsidePhone', label: 'Roadside phone', kind: 'tel' }, { key: 'householdMembers', label: 'Covered household members', kind: 'textarea' }, { key: 'photoFront', label: 'Card / barcode photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'costco', label: 'Costco Membership', subtitleKey: 'membershipNumber', fields: [{ key: 'memberName', label: 'Member name', required: true }, { key: 'membershipNumber', label: 'Membership number', required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'householdMember', label: 'Household member' }, { key: 'photoFront', label: 'Barcode / card photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'sams_bjs', label: "Sam's Club / BJ's", subtitleKey: 'membershipNumber', fields: [{ key: 'storeName', label: 'Store', kind: 'select', options: [{ value: 'sams', label: "Sam's Club" }, { value: 'bjs', label: "BJ's" }] }, { key: 'memberName', label: 'Member name', required: true }, { key: 'membershipNumber', label: 'Membership number', required: true }, { key: 'membershipTier', label: 'Membership tier' }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'photoFront', label: 'Barcode / QR / photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'pharmacy', label: 'Pharmacy Card', subtitleKey: 'pharmacyName', fields: [{ key: 'pharmacyName', label: 'Pharmacy name', required: true }, { key: 'rxMemberId', label: 'RX / member ID', required: true }, { key: 'phone', label: 'Phone', kind: 'tel' }, { key: 'preferredLocation', label: 'Preferred location' }, { key: 'photoFront', label: 'Barcode / photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'rx_discount', label: 'Prescription Discount Card', subtitleKey: 'programName', fields: [{ key: 'programName', label: 'Program name', required: true }, { key: 'memberId', label: 'Member ID', required: true }, { key: 'bin', label: 'BIN' }, { key: 'pcn', label: 'PCN' }, { key: 'groupNumber', label: 'Group number' }, { key: 'photoFront', label: 'Barcode / photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'grocery_rewards', label: 'Grocery Rewards Card', subtitleKey: 'storeName', fields: [{ key: 'storeName', label: 'Store name', required: true }, { key: 'rewardsNumber', label: 'Rewards number', required: true }, { key: 'phone', label: 'Phone on account', kind: 'tel' }, { key: 'photoFront', label: 'Barcode / photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'gas_rewards', label: 'Gas Rewards Card', subtitleKey: 'gasBrand', fields: [{ key: 'gasBrand', label: 'Gas brand', required: true }, { key: 'rewardsNumber', label: 'Rewards number', required: true }, { key: 'phone', label: 'Phone on account', kind: 'tel' }, { key: 'photoFront', label: 'Barcode / QR / photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'airline_loyalty', label: 'Airline Loyalty', subtitleKey: 'airline', fields: [{ key: 'airline', label: 'Airline', required: true }, { key: 'loyaltyNumber', label: 'Loyalty number', required: true }, { key: 'statusTier', label: 'Status tier' }, { key: 'expirationDate', label: 'Status end date', kind: 'date' }, { key: 'knownTravelerNumber', label: 'Known traveler # (optional)' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'hotel_loyalty', label: 'Hotel Loyalty', subtitleKey: 'hotelBrand', fields: [{ key: 'hotelBrand', label: 'Hotel brand', required: true }, { key: 'loyaltyNumber', label: 'Loyalty number', required: true }, { key: 'statusTier', label: 'Status tier' }, { key: 'expirationDate', label: 'Status end date', kind: 'date' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'car_rental_loyalty', label: 'Car Rental Loyalty', subtitleKey: 'rentalCompany', fields: [{ key: 'rentalCompany', label: 'Rental company', required: true }, { key: 'loyaltyNumber', label: 'Loyalty number', required: true }, { key: 'statusTier', label: 'Status tier' }, { key: 'expirationDate', label: 'Status end date', kind: 'date' }, { key: 'driverProfileNotes', label: 'Driver profile notes', kind: 'textarea' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'gym', label: 'Gym Membership', subtitleKey: 'gymName', fields: [{ key: 'gymName', label: 'Gym name', required: true }, { key: 'memberId', label: 'Member ID', required: true }, { key: 'homeLocation', label: 'Home location' }, { key: 'billingDate', label: 'Billing date', kind: 'date' }, { key: 'expirationDate', label: 'Contract end date', kind: 'date', required: true }, { key: 'cancellationNotes', label: 'Cancellation notes', kind: 'textarea' }, { key: 'photoFront', label: 'Barcode / QR / photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'library', label: 'Library Card', subtitleKey: 'librarySystem', fields: [{ key: 'librarySystem', label: 'Library system', required: true }, { key: 'cardNumber', label: 'Card number', required: true }, { key: 'pinHint', label: 'PIN hint' }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'photoFront', label: 'Barcode / photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'student_id', label: 'Student ID', subtitleKey: 'schoolName', fields: [{ key: 'schoolName', label: 'School name', required: true }, { key: 'studentId', label: 'Student ID number', required: true }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'emergencyContact', label: 'Emergency contact' }, { key: 'photoFront', label: 'Barcode / photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'employee_badge', label: 'Employee ID / Access Badge', subtitleKey: 'employer', fields: [{ key: 'employer', label: 'Employer', required: true }, { key: 'employeeId', label: 'Employee ID', required: true }, { key: 'department', label: 'Department' }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'accessNotes', label: 'Access notes', kind: 'textarea' }, { key: 'photoFront', label: 'Badge photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'building_access', label: 'Building Access Card', subtitleKey: 'buildingName', fields: [{ key: 'buildingName', label: 'Building name', required: true }, { key: 'unitOffice', label: 'Unit / office number' }, { key: 'accessCardId', label: 'Access card ID', required: true }, { key: 'parkingAccess', label: 'Parking access included' }, { key: 'replacementContact', label: 'Replacement contact' }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'photoFront', label: 'Card photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'transit', label: 'Transit Card', subtitleKey: 'transitSystem', fields: [{ key: 'transitSystem', label: 'Transit system', required: true }, { key: 'cardNumber', label: 'Card number', required: true }, { key: 'balance', label: 'Balance' }, { key: 'reloadNote', label: 'Reload link / account note' }, { key: 'expirationDate', label: 'Expiration', kind: 'date' }, { key: 'photoFront', label: 'Barcode / photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'parking', label: 'Parking Pass / Card', subtitleKey: 'garageLocation', fields: [{ key: 'garageLocation', label: 'Garage / location', required: true }, { key: 'passNumber', label: 'Pass number', required: true }, { key: 'vehiclePlate', label: 'Vehicle plate' }, { key: 'expirationDate', label: 'Expiration', kind: 'date', required: true }, { key: 'accessInstructions', label: 'Access instructions', kind: 'textarea' }, { key: 'photoFront', label: 'Barcode / photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'hsa_fsa', label: 'HSA / FSA Card', subtitleKey: 'provider', fields: [{ key: 'provider', label: 'Provider', required: true }, { key: 'cardholderName', label: 'Cardholder name', required: true }, { key: 'cardLast4', label: 'Card last 4 only' }, { key: 'expirationDate', label: 'Plan year end', kind: 'date', required: true }, { key: 'eligibleUseNotes', label: 'Eligible-use notes', kind: 'textarea' }, { key: 'supportPhone', label: 'Support phone', kind: 'tel' }, { key: 'photoFront', label: 'Card photo (optional)', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'gift_card', label: 'Gift Card', subtitleKey: 'merchant', fields: [{ key: 'merchant', label: 'Merchant', required: true }, { key: 'cardNumber', label: 'Card number' }, { key: 'pinCode', label: 'PIN / security code', kind: 'password' }, { key: 'balance', label: 'Balance' }, { key: 'expirationDate', label: 'Expiration', kind: 'date' }, { key: 'photoFront', label: 'Barcode / photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
  { id: 'loyalty_punch', label: 'Loyalty Punch / Reward Card', subtitleKey: 'businessName', fields: [{ key: 'businessName', label: 'Business name', required: true }, { key: 'rewardType', label: 'Reward type' }, { key: 'punchCount', label: 'Punch count' }, { key: 'expirationDate', label: 'Expiration', kind: 'date' }, { key: 'photoFront', label: 'Barcode / photo', kind: 'photo' }, { key: 'notes', label: 'Notes', kind: 'textarea' }] },
];

export function cardTypeDef(types: CardTypeDef[], typeId: string): CardTypeDef | undefined {
  return types.find((t) => t.id === typeId);
}

export function recordExpiration(record: WalletCardRecord): string {
  return record.expirationDate || record.fields.expirationDate || record.fields.coverageEnd || '';
}
