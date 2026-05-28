'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';
import { Modal } from '../dashboard/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  communityName: string;
  onSubmit: (payload: { message: string; agreed: true }) => Promise<void> | void;
  submitting?: boolean;
}

/**
 * Pop-up shown when a family clicks "Request to join" on a community.
 *
 * Captures an optional message to the admin and requires an explicit confirmation
 * that the family has read the community's description and core principles —
 * keeps both sides on the same page about why they're joining.
 */
export function JoinRequestDialog({ open, onClose, communityName, onSubmit, submitting }: Props) {
  const t = useTranslations('Community.joinRequest');
  const [message, setMessage] = useState('');
  const [agreed, setAgreed] = useState(false);

  async function submit() {
    if (!agreed) return;
    await onSubmit({ message: message.trim(), agreed: true });
    setMessage('');
    setAgreed(false);
  }

  function close() {
    if (submitting) return;
    setMessage('');
    setAgreed(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title={t('title', { community: communityName })}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{t('body')}</p>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            {t('messageLabel')}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder={t('messagePlaceholder')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-700 mb-2">{t('agreementHeading')}</p>
          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>{t('agreementBody')}</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="text-sm text-slate-600 hover:text-slate-800 px-3 py-2 disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <Button onClick={submit} disabled={!agreed || !!submitting}>
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
