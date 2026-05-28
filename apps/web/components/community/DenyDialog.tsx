'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';
import { Modal } from '../dashboard/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  familyName: string;
  onSubmit: (reason: string) => Promise<void> | void;
  submitting?: boolean;
}

/**
 * Pop-up shown when an admin clicks Deny on a pending join request. Forces a
 * non-empty reason — captured server-side as removed_reason on the membership
 * row so the family can be told why.
 */
export function DenyDialog({ open, onClose, familyName, onSubmit, submitting }: Props) {
  const t = useTranslations('Community.deny');
  const [reason, setReason] = useState('');

  async function submit() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
    setReason('');
  }

  function close() {
    if (submitting) return;
    setReason('');
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title={t('title')}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          <strong className="text-slate-800">{familyName}</strong> — {t('body')}
        </p>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            {t('reasonLabel')} <span className="text-red-500 ml-0.5">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="text-sm text-slate-600 hover:text-slate-800 px-3 py-2 disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <Button onClick={submit} disabled={!reason.trim() || !!submitting}>
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
