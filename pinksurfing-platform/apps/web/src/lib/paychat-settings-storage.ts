const KEY = 'ps-paychat-settings';

export type PayChatSettings = {
  step: number;
  accepting: boolean;
};

const DEFAULT: PayChatSettings = { step: 16, accepting: true };

function storageKey(email: string): string {
  return `${KEY}:${email || 'guest'}`;
}

export function loadPayChatSettings(email: string): PayChatSettings {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as PayChatSettings;
    return {
      step: typeof parsed.step === 'number' ? parsed.step : DEFAULT.step,
      accepting: typeof parsed.accepting === 'boolean' ? parsed.accepting : DEFAULT.accepting,
    };
  } catch {
    return DEFAULT;
  }
}

export function savePayChatSettings(email: string, settings: PayChatSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(email), JSON.stringify(settings));
  } catch {
    /* ignore quota */
  }
}
