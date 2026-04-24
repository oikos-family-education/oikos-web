'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';
import { Loader2 } from 'lucide-react';
import { FamilyApiResponse, FamilyFormData } from './familyFormTypes';

interface Props {
  formData: FamilyFormData;
  dirty: boolean;
  onSaved: (updated: FamilyApiResponse) => void;
  onCancel: () => void;
  buildPayload: () => Record<string, unknown>;
  children: React.ReactNode;
}

export function TabFormShell({ formData: _formData, dirty, onSaved, onCancel, buildPayload, children }: Props) {
  const t = useTranslations('Family');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSave = async () => {
    setSubmitting(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await fetch('/api/v1/families/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail = data?.detail;
        if (Array.isArray(detail)) {
          setError(detail.map((e: { msg?: string }) => e.msg ?? 'Validation error').join('; '));
        } else {
          setError(typeof detail === 'string' ? detail : t('saveError'));
        }
        return;
      }
      const updated: FamilyApiResponse = await res.json();
      onSaved(updated);
      setSuccessMessage(t('saved'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch {
      setError(t('saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 lg:p-8">
      {children}

      {error && (
        <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mt-6 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
        {dirty && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
          >
            {t('cancel')}
          </button>
        )}
        <Button type="button" onClick={handleSave} disabled={!dirty || submitting} className="px-6">
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {t('saving')}</>
          ) : (
            t('saveChanges')
          )}
        </Button>
      </div>
    </div>
  );
}
