'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@oikos/ui';
import { Modal } from '../dashboard/Modal';
import { apiFetch } from '../../lib/apiFetch';

interface Props {
  open: boolean;
  onClose: () => void;
  threadId: string;
  onSubmitted: () => void;
}

export function ReportDialog({ open, onClose, threadId, onSubmitted }: Props) {
  const t = useTranslations('Messages');
  const [reason, setReason] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (submitting) return;
    setReason('');
    setAlsoBlock(true);
    setError(null);
    onClose();
  }

  async function submit() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/messages/threads/${threadId}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: trimmed, also_block: alsoBlock }),
      });
      if (!res.ok) {
        setError(t('messageFailed'));
        return;
      }
      onSubmitted();
      setReason('');
      setAlsoBlock(true);
      onClose();
    } catch {
      setError(t('messageFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title={t('reportConfirmTitle')}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{t('reportConfirmBody')}</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={t('reportConfirmReasonPlaceholder')}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          autoFocus
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={alsoBlock}
            onChange={(e) => setAlsoBlock(e.target.checked)}
            className="rounded border-slate-300"
          />
          {t('reportConfirmAlsoBlock')}
        </label>
        {error && <p className="text-xs font-medium text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="text-sm text-slate-600 hover:text-slate-800 px-3 py-2 disabled:opacity-50"
          >
            {t('reportConfirmCancel')}
          </button>
          <Button onClick={submit} disabled={!reason.trim() || submitting}>
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              t('reportConfirmCta')
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
