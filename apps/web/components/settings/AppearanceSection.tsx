'use client';

import { apiFetch } from '../../lib/apiFetch';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type Theme = 'light' | 'dark';
type FontSize = 'default' | 'large' | 'xl';

export interface UiPreferences {
  theme: Theme;
  font_size: FontSize;
  reduce_motion: boolean;
  high_contrast: boolean;
  dyslexia_font: boolean;
  // Dashboard preference: days before a subject is flagged in "Needs Attention".
  neglected_threshold_days: number;
}

const DEFAULT: UiPreferences = {
  theme: 'light',
  font_size: 'default',
  reduce_motion: false,
  high_contrast: false,
  dyslexia_font: false,
  neglected_threshold_days: 14,
};

const LS_KEY = 'oikos:ui-prefs';

function applyToDOM(prefs: UiPreferences) {
  const html = document.documentElement;

  // Theme
  html.classList.remove('dark');
  if (prefs.theme === 'dark') {
    html.classList.add('dark');
  }

  // Font size
  html.classList.remove('font-large', 'font-xl');
  if (prefs.font_size === 'large') html.classList.add('font-large');
  if (prefs.font_size === 'xl') html.classList.add('font-xl');

  // Accessibility
  html.classList.toggle('reduce-motion', prefs.reduce_motion);
  html.classList.toggle('high-contrast', prefs.high_contrast);
  html.classList.toggle('dyslexia-font', prefs.dyslexia_font);
}

function persistLocally(prefs: UiPreferences) {
  localStorage.setItem(LS_KEY, JSON.stringify(prefs));
}

interface Props {
  initial: UiPreferences;
}

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

function AccessibilityToggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          checked ? 'bg-primary' : 'bg-slate-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function normalize(prefs: UiPreferences): UiPreferences {
  let next = prefs;
  // Legacy values stored as 'system' before the option was removed map to light.
  if ((next.theme as string) !== 'light' && (next.theme as string) !== 'dark') {
    next = { ...next, theme: 'light' };
  }
  // Backfill any newly-added prefs that older payloads may be missing.
  if (typeof next.neglected_threshold_days !== 'number') {
    next = { ...next, neglected_threshold_days: DEFAULT.neglected_threshold_days };
  }
  return next;
}

export function AppearanceSection({ initial }: Props) {
  const t = useTranslations('Settings');
  const [prefs, setPrefs] = useState<UiPreferences>(() => normalize(initial));

  // Apply preferences from DB on mount (may differ from localStorage)
  useEffect(() => {
    const normalized = normalize(initial);
    applyToDOM(normalized);
    persistLocally(normalized);
    setPrefs(normalized);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function update(patch: Partial<UiPreferences>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    applyToDOM(next);
    persistLocally(next);

    await apiFetch('/api/v1/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ui_preferences: patch }),
    });
  }

  const themeOptions: { value: Theme; labelKey: keyof typeof t }[] = [
    { value: 'light', labelKey: 'themeLight' as any },
    { value: 'dark', labelKey: 'themeDark' as any },
  ];

  const fontSizeOptions: { value: FontSize; labelKey: string }[] = [
    { value: 'default', labelKey: 'fontSizeDefault' },
    { value: 'large', labelKey: 'fontSizeLarge' },
    { value: 'xl', labelKey: 'fontSizeXl' },
  ];

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800">{t('appearanceTitle')}</h2>
      <p className="text-sm text-slate-500 mt-0.5 mb-6">{t('appearanceSubtitle')}</p>

      <div className="space-y-6 max-w-md">
        {/* Color theme */}
        <div className="w-full flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-700">{t('colorTheme')}</label>
          <div className="flex gap-2">
            {themeOptions.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ theme: value })}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  prefs.theme === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                {t(labelKey as any)}
              </button>
            ))}
          </div>
        </div>

        {/* Font size */}
        <div className="w-full flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-700">{t('fontSize')}</label>
          <div className="flex gap-2">
            {fontSizeOptions.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => update({ font_size: value })}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  prefs.font_size === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                }`}
              >
                {t(labelKey as any)}
              </button>
            ))}
          </div>
        </div>

        {/* Accessibility toggles */}
        <div className="border-t border-slate-100 pt-4">
          <AccessibilityToggle
            label={t('reduceMotion')}
            description={t('reduceMotionDesc')}
            checked={prefs.reduce_motion}
            onChange={(val) => update({ reduce_motion: val })}
          />
          <AccessibilityToggle
            label={t('highContrast')}
            description={t('highContrastDesc')}
            checked={prefs.high_contrast}
            onChange={(val) => update({ high_contrast: val })}
          />
          <AccessibilityToggle
            label={t('dyslexiaFont')}
            description={t('dyslexiaFontDesc')}
            checked={prefs.dyslexia_font}
            onChange={(val) => update({ dyslexia_font: val })}
          />
        </div>

        <button
          type="button"
          onClick={() => update(DEFAULT)}
          className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
        >
          {t('resetAppearance')}
        </button>
      </div>
    </section>
  );
}
