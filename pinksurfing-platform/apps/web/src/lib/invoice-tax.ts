/** Average combined state + local sales tax (approx.) for zip-based lookup */
const STATE_TAX_RATE: Record<string, number> = {
  AL: 9.22, AK: 1.76, AZ: 8.37, AR: 9.43, CA: 8.82, CO: 7.77, CT: 6.35, DE: 0,
  FL: 7.01, GA: 7.33, HI: 4.44, ID: 6.03, IL: 8.82, IN: 7, IA: 6.94, KS: 8.7,
  KY: 6, LA: 9.55, ME: 5.5, MD: 6, MA: 6.25, MI: 6, MN: 7.49, MS: 7.07, MO: 8.35,
  MT: 0, NE: 6.94, NV: 8.23, NH: 0, NJ: 6.6, NM: 7.83, NY: 8.52, NC: 6.98, ND: 6.96,
  OH: 7.23, OK: 8.95, OR: 0, PA: 6.34, RI: 7, SC: 7.44, SD: 6.4, TN: 9.55, TX: 8.2,
  UT: 7.19, VT: 6.24, VA: 5.75, WA: 9.29, WV: 6.5, WI: 5.43, WY: 5.36, DC: 6,
};

export function extractZip(text: string): string | null {
  const match = text.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

export async function taxRateForZip(zip: string): Promise<number | null> {
  const cleaned = zip.replace(/\D/g, '').slice(0, 5);
  if (cleaned.length !== 5) return null;

  try {
    const res = await fetch(`https://api.zippopotam.us/us/${cleaned}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      places?: { 'state abbreviation'?: string }[];
    };
    const state = data.places?.[0]?.['state abbreviation']?.toUpperCase();
    if (!state) return null;
    return STATE_TAX_RATE[state] ?? null;
  } catch {
    return null;
  }
}
