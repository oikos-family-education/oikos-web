'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import {
  apiToFormData,
  buildDefaultFormData,
  FamilyApiResponse,
  FamilyFormData,
} from './familyFormTypes';
import { IdentityTab } from './tabs/IdentityTab';
import { FaithTab } from './tabs/FaithTab';
import { EducationTab } from './tabs/EducationTab';
import { MembersTab } from './tabs/MembersTab';
import { PrivacyTab } from './tabs/PrivacyTab';

type TabKey = 'identity' | 'faith' | 'education' | 'members' | 'privacy';

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: 'identity', labelKey: 'tabIdentity' },
  { key: 'faith', labelKey: 'tabFaith' },
  { key: 'education', labelKey: 'tabEducation' },
  { key: 'members', labelKey: 'tabMembers' },
  { key: 'privacy', labelKey: 'tabPrivacy' },
];

function isTabKey(v: string | null): v is TabKey {
  return v === 'identity' || v === 'faith' || v === 'education' || v === 'members' || v === 'privacy';
}

export function FamilyPageClient() {
  const t = useTranslations('Family');
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState<TabKey>(isTabKey(initialTab) ? initialTab : 'identity');

  const [family, setFamily] = useState<FamilyApiResponse | null>(null);
  const [formData, setFormData] = useState<FamilyFormData>(buildDefaultFormData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadFamily = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/v1/families/me', { credentials: 'include' });
      if (!res.ok) {
        setLoadError(t('loadError'));
        return;
      }
      const data: FamilyApiResponse = await res.json();
      setFamily(data);
      setFormData(apiToFormData(data));
    } catch {
      setLoadError(t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFamily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTab = (next: TabKey) => {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', next);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const onFamilyUpdated = (updated: FamilyApiResponse) => {
    setFamily(updated);
    setFormData(apiToFormData(updated));
  };

  const tabs = useMemo(() => TABS, []);

  if (loading) {
    return (
      <div className="max-w-5xl flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError || !family) {
    return (
      <div className="max-w-5xl">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {loadError || t('loadError')}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{t('pageTitle')}</h1>
        <p className="text-slate-500 mt-1">{t('pageSubtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="hidden sm:flex gap-1 border-b border-slate-200 overflow-x-auto">
          {tabs.map(({ key, labelKey }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => switchTab(key)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  active
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
        <select
          className="sm:hidden w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
          value={tab}
          onChange={(e) => switchTab(e.target.value as TabKey)}
        >
          {tabs.map(({ key, labelKey }) => (
            <option key={key} value={key}>
              {t(labelKey)}
            </option>
          ))}
        </select>
      </div>

      <div>
        {tab === 'identity' && (
          <IdentityTab
            family={family}
            formData={formData}
            onFamilyUpdated={onFamilyUpdated}
          />
        )}
        {tab === 'faith' && (
          <FaithTab family={family} formData={formData} onFamilyUpdated={onFamilyUpdated} />
        )}
        {tab === 'education' && (
          <EducationTab family={family} formData={formData} onFamilyUpdated={onFamilyUpdated} />
        )}
        {tab === 'members' && <MembersTab />}
        {tab === 'privacy' && (
          <PrivacyTab family={family} formData={formData} onFamilyUpdated={onFamilyUpdated} />
        )}
      </div>
    </div>
  );
}
