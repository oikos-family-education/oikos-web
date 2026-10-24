'use client';

import { apiFetch } from '../../../lib/apiFetch';
import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '../../../lib/navigation';
import { AlertTriangle, Eye, EyeOff, Globe, Loader2, Trash2 } from 'lucide-react';
import { FamilyApiResponse, FamilyFormData } from '../familyFormTypes';
import { TabFormShell } from '../TabFormShell';
import { isDesktop } from '../../../lib/appMode';

interface Props {
  family: FamilyApiResponse;
  formData: FamilyFormData;
  onFamilyUpdated: (f: FamilyApiResponse) => void;
}

const VISIBILITY_OPTIONS = [
  { value: 'local', icon: Eye, label: 'Local', desc: 'Visible to families in your region who are also discoverable.' },
  { value: 'private', icon: EyeOff, label: 'Private', desc: 'Only you see your family. Invisible in community.' },
  { value: 'public', icon: Globe, label: 'Public', desc: 'Visible in the full family directory.' },
];

export function PrivacyTab({ family, formData: initial, onFamilyUpdated }: Props) {
  const t = useTranslations('Family');
  const tOnb = useTranslations('Onboarding');
  const tDesktop = useTranslations('Desktop');
  const router = useRouter();
  const desktop = isDesktop();

  const [formData, setFormData] = useState<FamilyFormData>(initial);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setFormData(initial);
    setDirty(false);
  }, [initial]);

  const setVisibility = (v: string) => {
    setFormData((prev) => ({ ...prev, visibility: v }));
    setDirty(true);
  };

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const deleteFamily = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await apiFetch('/api/v1/families/me', { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(typeof data.detail === 'string' ? data.detail : t('saveError'));
        return;
      }
      router.replace('/onboarding/family');
    } catch {
      setDeleteError(t('saveError'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Visibility */}
      <TabFormShell
        formData={formData}
        dirty={dirty}
        buildPayload={() => ({ visibility: formData.visibility })}
        onSaved={(updated) => {
          onFamilyUpdated(updated);
          setDirty(false);
        }}
        onCancel={() => {
          setFormData(initial);
          setDirty(false);
        }}
      >
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{t('visibilityHeading')}</h2>
            <p className="text-slate-500 text-sm mt-1">{tOnb('visibilityHelp')}</p>
            {desktop && <p className="text-xs font-medium text-slate-500 mt-2">{tDesktop('onlineOnlyNote')}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {VISIBILITY_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = formData.visibility === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  disabled={desktop}
                  className={`p-4 rounded-xl border-2 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    active
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-2 ${active ? 'text-primary' : 'text-slate-400'}`} />
                  <span className="text-sm font-semibold text-slate-700 block">{opt.label}</span>
                  <span className="text-xs text-slate-400 mt-1 block">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </TabFormShell>

      {/* Export moved to Settings → Backup */}
      <p className="text-sm text-slate-600">
        {t.rich('exportMovedNote', {
          link: (chunks) => (
            <Link href="/settings" className="font-medium text-primary hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>

      {/* Danger zone — delete family */}
      <div className="rounded-xl border border-red-200 bg-red-50/40 p-6 lg:p-8">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold text-slate-800">{t('deleteTitle')}</h2>
        </div>
        <p className="text-sm text-slate-700 mb-4">{t('deleteBody')}</p>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="inline-flex items-center justify-center whitespace-nowrap px-5 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600"
        >
          <Trash2 className="w-4 h-4 mr-2" /> {t('deleteButton')}
        </button>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-800">{t('deleteTitle')}</h3>
            <p className="text-sm text-slate-600 mt-2">{t('deleteBody')}</p>
            <div className="mt-4">
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">
                {t('deleteConfirmPrompt')}
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={t('deleteConfirmPlaceholder')}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                {family.family_name}
              </p>
            </div>
            {deleteError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmName('');
                  setDeleteError('');
                }}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={deleteFamily}
                disabled={deleting || confirmName.trim() !== family.family_name}
                className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('deletePermanent')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
