'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';
import { CheckCircle2 } from 'lucide-react';
import { useRouter, usePathname } from '../../lib/navigation';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
];

const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];

const TIME_FORMATS = [
  { value: '12h', labelKey: 'timeFormat12h' },
  { value: '24h', labelKey: 'timeFormat24h' },
] as const;

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Honolulu',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

interface Props {
  initialTimezone: string;
  initialLocale: string;
  initialDateFormat: string;
  initialTimeFormat: string;
}

export function LanguageRegionSection({
  initialTimezone,
  initialLocale,
  initialDateFormat,
  initialTimeFormat,
}: Props) {
  const t = useTranslations('Settings');
  const router = useRouter();
  const pathname = usePathname();

  const [locale, setLocale] = useState(initialLocale);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [dateFormat, setDateFormat] = useState(initialDateFormat);
  const [timeFormat, setTimeFormat] = useState(initialTimeFormat);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);

    const res = await fetch('/api/v1/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ locale, timezone, date_format: dateFormat, time_format: timeFormat }),
    });

    setSaving(false);

    if (!res.ok) {
      setError(t('errorGeneric'));
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);

    // Navigate to the same page in the new locale if it changed
    if (locale !== initialLocale) {
      router.replace(pathname, { locale });
    }
  }

  const selectClass =
    'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white hover:border-slate-300 transition-all';

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800">{t('languageTitle')}</h2>
      <p className="text-sm text-slate-500 mt-0.5 mb-6">{t('languageSubtitle')}</p>

      <div className="space-y-4 max-w-md">
        {/* Language */}
        <div className="w-full flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">{t('displayLanguage')}</label>
          <select
            className={selectClass}
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
          >
            {LANGUAGES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Timezone */}
        <div className="w-full flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">{t('timezone')}</label>
          <select
            className={selectClass}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Date format */}
        <div className="w-full flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">{t('dateFormat')}</label>
          <select
            className={selectClass}
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
          >
            {DATE_FORMATS.map((fmt) => (
              <option key={fmt} value={fmt}>{fmt}</option>
            ))}
          </select>
        </div>

        {/* Time format */}
        <div className="w-full flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">{t('timeFormat')}</label>
          <div className="flex gap-3">
            {TIME_FORMATS.map(({ value, labelKey }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <input
                  type="radio"
                  name="time_format"
                  value={value}
                  checked={timeFormat === value}
                  onChange={() => setTimeFormat(value)}
                  className="accent-primary"
                />
                {t(labelKey)}
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-xs font-medium text-red-500">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('saving') : t('saveChanges')}
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-success">
              <CheckCircle2 className="w-4 h-4" />
              {t('preferencesSaved')}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
