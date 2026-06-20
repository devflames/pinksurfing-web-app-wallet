import {
  EMPTY_PROFILE_STATUS,
  PROFILE_STATUS_CATEGORIES,
  type ProfileStatusCategory,
  type ProfileStatusSelection,
  type ProfileStatusSelections,
} from '@/lib/profile-status-options';

const KEY = 'ps-profile-status';

function storageKey(email: string): string {
  return `${KEY}:${email || 'guest'}`;
}

function isLegacySelections(parsed: unknown): parsed is Partial<ProfileStatusSelections> {
  return (
    !!parsed &&
    typeof parsed === 'object' &&
    ('business' in parsed || 'mood' in parsed || 'relationship' in parsed || 'magnetic' in parsed) &&
    !('value' in parsed)
  );
}

function migrateLegacy(parsed: Partial<ProfileStatusSelections>): ProfileStatusSelection {
  for (const cat of PROFILE_STATUS_CATEGORIES) {
    const value = parsed[cat.id]?.trim();
    if (value) return { category: cat.id, value };
  }
  return { ...EMPTY_PROFILE_STATUS };
}

export function loadProfileStatus(email: string): ProfileStatusSelection {
  if (typeof window === 'undefined') return { ...EMPTY_PROFILE_STATUS };
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) return { ...EMPTY_PROFILE_STATUS };
    const parsed = JSON.parse(raw) as unknown;
    if (isLegacySelections(parsed)) return migrateLegacy(parsed);
    const sel = parsed as Partial<ProfileStatusSelection>;
    return {
      category: sel.category ?? null,
      value: sel.value ?? '',
    };
  } catch {
    return { ...EMPTY_PROFILE_STATUS };
  }
}

export function saveProfileStatus(email: string, selection: ProfileStatusSelection): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(email), JSON.stringify(selection));
  } catch {
    /* ignore */
  }
}

export function setProfileStatus(
  email: string,
  category: ProfileStatusCategory,
  value: string
): ProfileStatusSelection {
  const next: ProfileStatusSelection = { category, value };
  saveProfileStatus(email, next);
  return next;
}

export function clearProfileStatus(email: string): ProfileStatusSelection {
  saveProfileStatus(email, EMPTY_PROFILE_STATUS);
  return { ...EMPTY_PROFILE_STATUS };
}
