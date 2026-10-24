'use client';

import React, { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';
import { Loader2 } from 'lucide-react';
import { isDesktop } from '../../lib/appMode';
import { Modal } from '../dashboard/Modal';
import { Alert } from '../ui/Alert';
import { LocalResetPasswordForm } from '../auth/LocalResetPasswordForm';

interface RestoreBackupButtonProps {
  className?: string;
}

/**
 * Desktop-only: pick a .oikos backup, confirm that it replaces everything, upload it,
 * then ask the parent to set a new password (backups never contain passwords).
 */
export function RestoreBackupButton({ className }: RestoreBackupButtonProps) {
  const t = useTranslations('Desktop');
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState('');
  const [restoredEmail, setRestoredEmail] = useState<string | null>(null);

  if (!isDesktop()) return null;

  if (restoredEmail !== null) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
        <div className="min-h-full flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <LocalResetPasswordForm initialEmail={restoredEmail} title={t('restoreDoneTitle')} />
          </div>
        </div>
      </div>
    );
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setError('');
    setFile(picked);
  }

  function clearFile() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function closeConfirm() {
    if (!restoring) clearFile();
  }

  async function handleRestore() {
    if (!file) return;
    setRestoring(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/v1/desktop/restore', {
        method: 'POST',
        body,
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const code = data?.detail?.code;
        if (res.status === 400 && code === 'not_a_backup') setError(t('restoreNotABackup'));
        else if (res.status === 400 && code === 'backup_too_new') setError(t('restoreTooNew'));
        else setError(t('restoreFailed'));
        clearFile();
        return;
      }
      const data = await res.json();
      setRestoredEmail(Array.isArray(data?.emails) && data.emails[0] ? String(data.emails[0]) : '');
    } catch {
      setError(t('restoreFailed'));
      clearFile();
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept=".oikos"
        className="hidden"
        onChange={handlePick}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex w-full sm:w-auto items-center justify-center whitespace-nowrap px-7 py-3.5 rounded-2xl bg-white text-slate-700 border border-slate-200 font-semibold text-base hover:border-primary hover:text-primary transition-all transform hover:-translate-y-1 active:scale-95 shadow-sm"
      >
        {t('restoreButton')}
      </button>
      {error && (
        <div className="mt-3 text-left">
          <Alert type="error" message={error} />
        </div>
      )}
      <Modal
        open={file !== null}
        onClose={closeConfirm}
        title={t('restoreConfirmTitle')}
        footer={
          <>
            <button
              type="button"
              onClick={closeConfirm}
              disabled={restoring}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
            >
              {t('restoreCancel')}
            </button>
            <Button type="button" onClick={handleRestore} disabled={restoring} className="px-5">
              {restoring ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('restoreConfirmButton')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{t('restoreConfirmBody')}</p>
      </Modal>
    </div>
  );
}
