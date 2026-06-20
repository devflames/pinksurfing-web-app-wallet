export type ProfileStatusCategory = 'business' | 'mood' | 'relationship' | 'magnetic';

/** Single status pick — one choice across all four category columns */
export type ProfileStatusSelection = {
  category: ProfileStatusCategory | null;
  value: string;
};

/** @deprecated Legacy multi-category shape — migrated on load */
export type ProfileStatusSelections = Record<ProfileStatusCategory, string>;

export type ProfileStatusCategoryDef = {
  id: ProfileStatusCategory;
  label: string;
  description: string;
  options: string[];
};

export const PROFILE_STATUS_CATEGORIES: ProfileStatusCategoryDef[] = [
  {
    id: 'business',
    label: 'Business execution',
    description: 'What you are doing professionally right now',
    options: [
      'Closing Deals',
      'Raising Capital',
      'Reviewing Opportunities',
      'Looking for Buyers',
      'Looking for Sellers',
      'Open to Investors',
      'Open to Partnerships',
      'In Execution Mode',
      'In Research Mode',
      'Heads Down',
      'Need Fast Answers',
      'Ready to Build',
      'Ready to Buy',
      'Ready to Sell',
      'Seeking Talent',
      'Building quietly',
      'Building loudly',
    ],
  },
  {
    id: 'mood',
    label: 'Mood / Aura',
    description: 'Real emotional or energetic state',
    options: [
      'Rainmaking',
      'Dealmaking',
      'In the Zone',
      'Locked In',
      'On Fire',
      'Winning',
      'Unstoppable',
      'Boss mode',
      'Visionary',
      'Mission driven',
      'Charging Forward',
      'Building Quietly',
      'Hunting',
      'Momentum',
      'Elated',
      'Pensive',
      'Focused',
      'Motivated',
      'Confident',
      'Calm',
      'Excited',
      'Ambitious',
      'Grateful',
      'Creative',
      'Curious',
      'Hopeful',
      'Playful',
      'Bold',
      'Relaxed',
      'Tired',
      'Stressed',
      'Frustrated',
      'Reflective',
      'Unbothered',
    ],
  },
  {
    id: 'relationship',
    label: 'Relationship status',
    description: 'Dating & social discovery — kept separate on purpose',
    options: [
      'Single',
      'Dating',
      'Talking',
      'Seeing Someone',
      'In a Relationship',
      "It's Complicated",
      'Married',
      'Door is Open',
      'Open to Dating',
      'Not Looking',
      'Flirting',
      'Heartbroken',
      'Healing',
      'Private',
      'Flirty',
      'Interested',
      'Curious',
      'Selective',
      'Open to Meet',
      'Lover Mode',
      'Romantic',
      'Slayer Mode',
      'Rake',
      'Loyal',
      'Smitten',
      'Cautious',
      'Guarded',
      'Unavailable',
      'Tempted',
      'Charmed',
      'Dreamy',
      'Open relationship',
    ],
  },
  {
    id: 'magnetic',
    label: 'Magnetic / Seductive mood',
    description: 'Energy you are putting out socially',
    options: [
      'Magnetic',
      'Alluring',
      'Mysterious',
      'Teasing',
      'Flirty',
      'Captivating',
      'Soft Power',
      'Dangerous',
      'Hypnotic',
      'Slow Burn',
      'Irresistible',
      'Velvet',
      'Enchanting',
      'Provocative',
      'Playfully Wicked',
      'Untouchable',
      'Divine Feminine',
      'Gentleman Danger',
      'Siren energy',
      'Rake energy',
    ],
  },
];

export const EMPTY_PROFILE_STATUS: ProfileStatusSelection = {
  category: null,
  value: '',
};

export const CATEGORY_ACCENT: Record<
  ProfileStatusCategory,
  { color: string; bg: string; border: string }
> = {
  business: {
    color: 'var(--ps-cyan)',
    bg: 'rgba(0, 184, 255, 0.12)',
    border: 'rgba(0, 184, 255, 0.35)',
  },
  mood: {
    color: 'var(--ps-pink)',
    bg: 'rgba(151, 71, 255, 0.12)',
    border: 'rgba(151, 71, 255, 0.35)',
  },
  relationship: {
    color: 'var(--ps-amber)',
    bg: 'rgba(239, 159, 39, 0.12)',
    border: 'rgba(239, 159, 39, 0.35)',
  },
  magnetic: {
    color: '#ff1493',
    bg: 'rgba(255, 20, 147, 0.12)',
    border: 'rgba(255, 20, 147, 0.35)',
  },
};

export function profileStatusSummary(selection: ProfileStatusSelection): string {
  return selection.value || 'Set your status';
}

export function profileStatusCategoryLabel(selection: ProfileStatusSelection): string | null {
  if (!selection.category) return null;
  return PROFILE_STATUS_CATEGORIES.find((c) => c.id === selection.category)?.label ?? null;
}

export function primaryBusinessStatus(selection: ProfileStatusSelection): string {
  return selection.value || 'Available for projects';
}
