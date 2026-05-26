/**
 * Curated country list for family location pickers.
 *
 * Each entry pairs an ISO 3166-1 alpha-2 code with a display name. The code is
 * the source of truth — it's what backend filters compare against. Display
 * names exist for the UI; they're English-only for now and will be localised
 * when the app gains more locales.
 *
 * Keep this list focused on places with active homeschooling communities; add
 * new entries as users ask for them.
 */

export interface Country {
  code: string;
  name: string;
}

export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'BR', name: 'Brazil' },
  { code: 'PT', name: 'Portugal' },
  { code: 'ES', name: 'Spain' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'IT', name: 'Italy' },
  { code: 'PL', name: 'Poland' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'IN', name: 'India' },
  { code: 'PH', name: 'Philippines' },
  { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
];

export function findCountryByCode(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase();
  return COUNTRIES.find((c) => c.code === upper);
}

export function findCountryByName(name: string | null | undefined): Country | undefined {
  if (!name) return undefined;
  const lower = name.trim().toLowerCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === lower);
}
