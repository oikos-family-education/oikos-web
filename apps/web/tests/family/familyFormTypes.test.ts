import { describe, it, expect, vi } from 'vitest';
import {
  detectBrowserLanguage,
  buildDefaultFormData,
  apiToFormData,
  type FamilyApiResponse,
} from '../../components/family/familyFormTypes';

describe('detectBrowserLanguage', () => {
  it('returns "English" when navigator.language is en-US', () => {
    vi.stubGlobal('navigator', { language: 'en-US' });
    expect(detectBrowserLanguage()).toBe('English');
    vi.unstubAllGlobals();
  });

  it('returns "Spanish" for es-ES', () => {
    vi.stubGlobal('navigator', { language: 'es-ES' });
    expect(detectBrowserLanguage()).toBe('Spanish');
    vi.unstubAllGlobals();
  });

  it('returns "Portuguese" for pt-BR', () => {
    vi.stubGlobal('navigator', { language: 'pt-BR' });
    expect(detectBrowserLanguage()).toBe('Portuguese');
    vi.unstubAllGlobals();
  });

  it('returns "Mandarin" for zh-CN', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN' });
    expect(detectBrowserLanguage()).toBe('Mandarin');
    vi.unstubAllGlobals();
  });

  it('falls back to English for unknown language codes', () => {
    vi.stubGlobal('navigator', { language: 'xx-YY' });
    expect(detectBrowserLanguage()).toBe('English');
    vi.unstubAllGlobals();
  });

  it('returns English when navigator is undefined (SSR safe)', () => {
    const originalNav = globalThis.navigator;
    // @ts-expect-error — purposeful undefined for SSR-safety check
    delete globalThis.navigator;
    try {
      expect(detectBrowserLanguage()).toBe('English');
    } finally {
      globalThis.navigator = originalNav;
    }
  });
});

describe('buildDefaultFormData', () => {
  it('returns an object with all required keys', () => {
    const data = buildDefaultFormData();
    expect(data).toHaveProperty('family_name');
    expect(data).toHaveProperty('location_city');
    expect(data).toHaveProperty('faith_tradition');
    expect(data).toHaveProperty('education_purpose');
    expect(data).toHaveProperty('home_languages');
    expect(data).toHaveProperty('visibility');
  });

  it('initializes empty strings for text fields', () => {
    const data = buildDefaultFormData();
    expect(data.family_name).toBe('');
    expect(data.location_city).toBe('');
    expect(data.faith_tradition).toBe('');
  });

  it('initializes empty arrays for list fields', () => {
    const data = buildDefaultFormData();
    expect(data.education_methods).toEqual([]);
    expect(data.current_curriculum).toEqual([]);
  });

  it('defaults visibility to "local"', () => {
    expect(buildDefaultFormData().visibility).toBe('local');
  });

  it('seeds home_languages with the detected browser language', () => {
    const data = buildDefaultFormData();
    expect(data.home_languages).toHaveLength(1);
    expect(typeof data.home_languages[0]).toBe('string');
  });
});

describe('apiToFormData', () => {
  const minimal: FamilyApiResponse = {
    id: 'f1',
    family_name: 'Smith',
    family_name_slug: 'smith',
    shield_config: null,
    location_city: null,
    location_region: null,
    location_country: null,
    location_country_code: null,
    faith_tradition: null,
    faith_denomination: null,
    faith_community_name: null,
    worldview_notes: null,
    education_purpose: null,
    education_methods: [],
    current_curriculum: [],
    diet: null,
    screen_policy: null,
    outdoor_orientation: null,
    home_languages: [],
    family_culture: null,
    visibility: 'local',
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };

  it('converts null fields to empty strings', () => {
    const f = apiToFormData(minimal);
    expect(f.location_city).toBe('');
    expect(f.faith_tradition).toBe('');
    expect(f.education_purpose).toBe('');
  });

  it('preserves array fields', () => {
    const f = apiToFormData({
      ...minimal,
      education_methods: ['classical', 'charlotte_mason'],
    });
    expect(f.education_methods).toEqual(['classical', 'charlotte_mason']);
  });

  it('seeds home_languages with detected browser language when API returns empty', () => {
    const f = apiToFormData(minimal);
    expect(f.home_languages.length).toBe(1);
  });

  it('preserves home_languages when API returns non-empty', () => {
    const f = apiToFormData({ ...minimal, home_languages: ['Portuguese', 'English'] });
    expect(f.home_languages).toEqual(['Portuguese', 'English']);
  });

  it('preserves visibility from API', () => {
    expect(apiToFormData({ ...minimal, visibility: 'public' }).visibility).toBe('public');
  });
});
