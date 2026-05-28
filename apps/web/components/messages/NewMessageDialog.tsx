'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@oikos/ui';
import { Modal } from '../dashboard/Modal';
import { apiFetch } from '../../lib/apiFetch';
import { useRouter } from '../../lib/navigation';
import type { StartThreadResponse } from './types';

const MAX_BODY = 4000;

interface Props {
  open: boolean;
  onClose: () => void;
  recipientFamilyId: string;
  recipientFamilyName: string;
}

/**
 * Modal opened from the Discover/profile "Send message" button.
 * If a thread already exists between the two families, the backend returns it
 * and we navigate straight to it. If it doesn't, the first message is sent
 * with the create call.
 */
export function NewMessageDialog({
  open,
  onClose,
  recipientFamilyId,
  recipientFamilyName,
}: Props) {
  const t = useTranslations('Messages');
  const router = useRouter();
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (submitting) return;
    setBody('');
    setError(null);
    onClose();
  }

  async function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/messages/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_family_id: recipientFamilyId,
          body: trimmed,
        }),
      });
      if (res.status === 429) {
        setError(t('rateLimited'));
        return;
      }
      if (!res.ok) {
        setError(t('messageFailed'));
        return;
      }
      const data: StartThreadResponse = await res.json();
      onClose();
      setBody('');
      router.push(`/messages/${data.thread.id}`);
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
      title={t('newMessageTitle', { familyName: recipientFamilyName })}
    >
      <div className="space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('newMessagePlaceholder')}
          rows={6}
          maxLength={MAX_BODY}
          autoFocus
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{t('composerHint')}</span>
          <span>{body.length}/{MAX_BODY}</span>
        </div>
        {error && (
          <p className="text-xs font-medium text-red-500">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="text-sm text-slate-600 hover:text-slate-800 px-3 py-2 disabled:opacity-50"
          >
            {t('newMessageCancel')}
          </button>
          <Button onClick={submit} disabled={!body.trim() || submitting}>
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              t('newMessageSend')
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
