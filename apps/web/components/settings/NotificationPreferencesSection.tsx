'use client';

import { apiFetch } from '../../lib/apiFetch';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface NotificationPreferences {
  weekly_summary: boolean;
  lesson_reminders: boolean;
  lesson_reminder_offset_hours: number;
  progress_milestones: boolean;
  member_activity: boolean;
  platform_news: boolean;
}

interface Props {
  initial: NotificationPreferences;
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  children?: React.ReactNode;
}

function ToggleRow({ label, description, checked, onChange, children }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-slate-100 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        {children && checked && <div className="mt-3">{children}</div>}
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

export function NotificationPreferencesSection({ initial }: Props) {
  const t = useTranslations('Settings');
  const [prefs, setPrefs] = useState<NotificationPreferences>(initial);
  const [saving, setSaving] = useState<string | null>(null);

  async function patch(update: Partial<NotificationPreferences>) {
    const next = { ...prefs, ...update };
    setPrefs(next);
    setSaving(Object.keys(update)[0]);
    await apiFetch('/api/v1/users/me/notification-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(update),
    });
    setSaving(null);
  }

  const OFFSET_OPTIONS = [
    { value: 1, labelKey: 'notifReminderOffset1h' },
    { value: 2, labelKey: 'notifReminderOffset2h' },
    { value: 24, labelKey: 'notifReminderOffset24h' },
  ] as const;

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800">{t('notificationsTitle')}</h2>
      <p className="text-sm text-slate-500 mt-0.5 mb-2">{t('notificationsSubtitle')}</p>

      <div>
        <ToggleRow
          label={t('notifWeeklySummary')}
          description={t('notifWeeklySummaryDesc')}
          checked={prefs.weekly_summary}
          onChange={(val) => patch({ weekly_summary: val })}
        />
        <ToggleRow
          label={t('notifLessonReminders')}
          description={t('notifLessonRemindersDesc')}
          checked={prefs.lesson_reminders}
          onChange={(val) => patch({ lesson_reminders: val })}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">{t('notifReminderOffset')}</label>
            <div className="flex gap-3 flex-wrap">
              {OFFSET_OPTIONS.map(({ value, labelKey }) => (
                <label key={value} className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-700">
                  <input
                    type="radio"
                    name="reminder_offset"
                    value={value}
                    checked={prefs.lesson_reminder_offset_hours === value}
                    onChange={() => patch({ lesson_reminder_offset_hours: value })}
                    className="accent-primary"
                  />
                  {t(labelKey)}
                </label>
              ))}
            </div>
          </div>
        </ToggleRow>
        <ToggleRow
          label={t('notifProgressMilestones')}
          description={t('notifProgressMilestonesDesc')}
          checked={prefs.progress_milestones}
          onChange={(val) => patch({ progress_milestones: val })}
        />
        <ToggleRow
          label={t('notifMemberActivity')}
          description={t('notifMemberActivityDesc')}
          checked={prefs.member_activity}
          onChange={(val) => patch({ member_activity: val })}
        />
        <ToggleRow
          label={t('notifPlatformNews')}
          description={t('notifPlatformNewsDesc')}
          checked={prefs.platform_news}
          onChange={(val) => patch({ platform_news: val })}
        />
      </div>
      {saving && (
        <p className="text-xs text-slate-400 mt-2">{t('saving')}</p>
      )}
    </section>
  );
}
