'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AccountInfoSection } from './AccountInfoSection';
import { ChangePasswordSection } from './ChangePasswordSection';
import { LanguageRegionSection } from './LanguageRegionSection';
import { AppearanceSection, UiPreferences } from './AppearanceSection';
import { DangerZoneSection } from './DangerZoneSection';

interface UserSettings {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  last_login_at: string | null;
  timezone: string;
  locale: string;
  date_format: string;
  time_format: string;
  ui_preferences: UiPreferences;
  has_family?: boolean;
}

export function SettingsPageClient() {
  const t = useTranslations('Settings');
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/users/me/settings', { credentials: 'include' }),
      fetch('/api/v1/auth/me', { credentials: 'include' }),
    ])
      .then(async ([settingsRes, meRes]) => {
        if (!settingsRes.ok) throw new Error();
        const data = await settingsRes.json();
        const meData = meRes.ok ? await meRes.json() : null;
        setSettings({ ...data, has_family: meData?.user?.has_family ?? false });
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
            <div className="h-5 bg-slate-100 rounded w-1/3 mb-3" />
            <div className="h-3 bg-slate-100 rounded w-1/2 mb-6" />
            <div className="space-y-3">
              <div className="h-10 bg-slate-100 rounded" />
              <div className="h-10 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="max-w-2xl">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-500 text-sm">{t('errorGeneric')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{t('pageTitle')}</h1>
        <p className="text-slate-500 mt-1">{t('pageSubtitle')}</p>
      </div>

      <AccountInfoSection
        initialFirstName={settings.first_name ?? ''}
        initialLastName={settings.last_name ?? ''}
        email={settings.email}
        onNameSaved={(firstName, lastName) =>
          setSettings((s) => s ? { ...s, first_name: firstName, last_name: lastName } : s)
        }
      />

      <ChangePasswordSection lastLoginAt={settings.last_login_at} />

      <LanguageRegionSection
        initialTimezone={settings.timezone}
        initialLocale={settings.locale}
        initialDateFormat={settings.date_format}
        initialTimeFormat={settings.time_format}
      />

      <AppearanceSection initial={settings.ui_preferences} />

      <DangerZoneSection
        email={settings.email}
        isPrimaryOwner={settings.has_family ?? false}
      />
    </div>
  );
}
