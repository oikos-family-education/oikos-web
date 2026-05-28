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
  familyId: string;
  familyName: string;
  onBlocked: () => void;
}

export function BlockConfirmDialog({ open, onClose, familyId, familyName, onBlocked }: Props) {
  const t = useTranslations('Messages');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (submitting) return;
    setError(null);
    onClose();
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/messages/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_id: familyId }),
      });
      if (!res.ok) {
        setError(t('messageFailed'));
        return;
      }
      onBlocked();
      onClose();
    } catch {
      setError(t('messageFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('blockConfirmTitle', { familyName })}
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{t('blockConfirmBody')}</p>
        {error && <p className="text-xs font-medium text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="text-sm text-slate-600 hover:text-slate-800 px-3 py-2 disabled:opacity-50"
          >
            {t('blockConfirmCancel')}
          </button>
          <Button onClick={submit} disabled={submitting} className="!bg-red-600 hover:!bg-red-700">
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              t('blockConfirmCta')
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
