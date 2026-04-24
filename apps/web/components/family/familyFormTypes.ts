const LANGUAGE_CODE_MAP: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese',
  de: 'German', it: 'Italian', nl: 'Dutch', ru: 'Russian',
  zh: 'Mandarin', ja: 'Japanese', ko: 'Korean', ar: 'Arabic',
  hi: 'Hindi', tr: 'Turkish', pl: 'Polish', sv: 'Swedish',
};

export function detectBrowserLanguage(): string {
  if (typeof navigator === 'undefined') return 'English';
  const code = (navigator.language || 'en').split('-')[0].toLowerCase();
  return LANGUAGE_CODE_MAP[code] ?? 'English';
}

export interface FamilyFormData {
  // Step 1
  family_name: string;
  location_city: string;
  location_region: string;
  location_country: string;
  location_country_code: string;
  // Step 2
  faith_tradition: string;
  faith_denomination: string;
  faith_community_name: string;
  worldview_notes: string;
  // Step 3
  education_purpose: string;
  education_methods: string[];
  current_curriculum: string[];
  diet: string;
  screen_policy: string;
  outdoor_orientation: string;
  home_languages: string[];
  family_culture: string;
  visibility: string;
}

export function buildDefaultFormData(): FamilyFormData {
  return {
    family_name: '',
    location_city: '',
    location_region: '',
    location_country: '',
    location_country_code: '',
    faith_tradition: '',
    faith_denomination: '',
    faith_community_name: '',
    worldview_notes: '',
    education_purpose: '',
    education_methods: [],
    current_curriculum: [],
    diet: '',
    screen_policy: '',
    outdoor_orientation: '',
    home_languages: [detectBrowserLanguage()],
    family_culture: '',
    visibility: 'local',
  };
}

export interface FamilyApiResponse {
  id: string;
  family_name: string;
  family_name_slug: string;
  shield_config: Record<string, string> | null;
  location_city: string | null;
  location_region: string | null;
  location_country: string | null;
  location_country_code: string | null;
  faith_tradition: string | null;
  faith_denomination: string | null;
  faith_community_name: string | null;
  worldview_notes: string | null;
  education_purpose: string | null;
  education_methods: string[];
  current_curriculum: string[];
  diet: string | null;
  screen_policy: string | null;
  outdoor_orientation: string | null;
  home_languages: string[];
  family_culture: string | null;
  visibility: string;
  created_at: string;
  updated_at: string;
}

export function apiToFormData(f: FamilyApiResponse): FamilyFormData {
  return {
    family_name: f.family_name ?? '',
    location_city: f.location_city ?? '',
    location_region: f.location_region ?? '',
    location_country: f.location_country ?? '',
    location_country_code: f.location_country_code ?? '',
    faith_tradition: f.faith_tradition ?? '',
    faith_denomination: f.faith_denomination ?? '',
    faith_community_name: f.faith_community_name ?? '',
    worldview_notes: f.worldview_notes ?? '',
    education_purpose: f.education_purpose ?? '',
    education_methods: f.education_methods ?? [],
    current_curriculum: f.current_curriculum ?? [],
    diet: f.diet ?? '',
    screen_policy: f.screen_policy ?? '',
    outdoor_orientation: f.outdoor_orientation ?? '',
    home_languages: f.home_languages?.length ? f.home_languages : [detectBrowserLanguage()],
    family_culture: f.family_culture ?? '',
    visibility: f.visibility ?? 'local',
  };
}
