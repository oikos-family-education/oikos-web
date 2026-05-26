'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';
import { Modal } from '../dashboard/Modal';
import { apiFetch } from '../../lib/apiFetch';

interface Props {
  open: boolean;
  onClose: () => void;
  slug: string;
  targetType: 'topic' | 'reply' | 'family';
  targetId: string;
}

export function ReportDialog({ open, onClose, slug, targetType, targetId }: Props) {
  const t = useTranslations('Community.report');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/v1/communities/${slug}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, reason }),
      });
      if (res.ok) setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setReason('');
    setDone(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title={t('title')}>
      {done ? (
        <p className="text-sm text-success">{t('thanks')}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">{t('body')}</p>
          <label className="block text-sm font-semibold text-slate-700">
            {t('reasonLabel')} <span className="text-red-500 ml-0.5">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={submitting || !reason.trim()}>
              {submitting ? t('submitting') : t('submit')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
