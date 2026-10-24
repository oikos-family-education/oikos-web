'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/apiFetch';
import { Alert } from '../ui/Alert';

const FALLBACK_FILENAME = 'Oikos-backup.oikos';

function filenameFrom(contentDisposition: string | null): string {
  const match = contentDisposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (!match) return FALLBACK_FILENAME;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function BackupSection() {
  const t = useTranslations('Settings');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const res = await apiFetch('/api/v1/families/me/export', { method: 'POST' });
      if (!res.ok) {
        setError(t('backupError'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFrom(res.headers.get('Content-Disposition'));
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('backupError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800">{t('backupTitle')}</h2>
      <p className="text-sm text-slate-500 mt-0.5 mb-6">{t('backupSubtitle')}</p>

      {error && <Alert type="error" message={error} />}

      <Button type="button" onClick={handleSave} disabled={saving} className="px-5">
        {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('backupButton')}
      </Button>
    </section>
  );
}
