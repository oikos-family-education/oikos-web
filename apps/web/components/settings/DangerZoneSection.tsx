'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@oikos/ui';
import { Button } from '@oikos/ui';
import { Loader2, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  email: string;
  isPrimaryOwner: boolean;
}

export function DangerZoneSection({ email, isPrimaryOwner }: Props) {
  const t = useTranslations('Settings');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setError('');
    setDeleting(true);
    const res = await fetch('/api/v1/users/me', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: confirmEmail, current_password: password }),
    });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body?.detail;
      if (typeof detail === 'object' && detail?.code === 'primary_owner_must_delete_family_first') {
        setError(t('primaryOwnerError'));
      } else {
        setError(t('deleteError'));
      }
      return;
    }
    router.replace('/login');
  }

  const canSubmit =
    !deleting &&
    confirmEmail.toLowerCase() === email.toLowerCase() &&
    password.length > 0;

  return (
    <section className="bg-white rounded-xl border border-red-200 p-6">
      <h2 className="text-lg font-semibold text-red-700">{t('dangerTitle')}</h2>
      <p className="text-sm text-slate-500 mt-0.5 mb-6">{t('dangerSubtitle')}</p>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-red-50 rounded-lg border border-red-100">
        <div>
          <p className="text-sm font-semibold text-slate-800">{t('deleteAccount')}</p>
          <p className="text-xs text-slate-500 mt-0.5 max-w-sm">{t('deleteAccountDesc')}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
        >
          {t('deleteAccountButton')}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-white max-w-md w-full p-6 space-y-5">
            <div className="flex items-start gap-3">
              <span className="inline-flex p-2 rounded-xl bg-red-100">
                <TriangleAlert className="w-5 h-5 text-red-600" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-800">{t('deleteModalTitle')}</h3>
                <p className="text-sm text-slate-600 mt-1">{t('deleteModalBody')}</p>
              </div>
            </div>

            {isPrimaryOwner && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                {t('deleteModalPrimaryOwnerWarning')}
              </div>
            )}

            <div className="space-y-3">
              <div className="w-full flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  {t('deleteModalEmailLabel')}
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={email}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:bg-white transition-all"
                />
              </div>

              <div className="w-full flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  {t('deleteModalPasswordLabel')}
                  <span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:bg-white transition-all"
                />
              </div>
            </div>

            {error && <p className="text-xs font-medium text-red-500">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setOpen(false); setError(''); setConfirmEmail(''); setPassword(''); }}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {/* Cancel */}
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canSubmit}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t('deleting')}</>
                ) : (
                  t('deleteModalConfirm')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
