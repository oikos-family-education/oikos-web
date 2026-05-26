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
}

export function InviteDialog({ open, onClose, slug }: Props) {
  const t = useTranslations('Community.invite');
  const [creating, setCreating] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  async function generate() {
    setCreating(true);
    try {
      const res = await apiFetch(`/api/v1/communities/${slug}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family_id: null }),
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
      }
    } finally {
      setCreating(false);
    }
  }

  function close() {
    setToken(null);
    onClose();
  }

  const link =
    token && typeof window !== 'undefined'
      ? `${window.location.origin}/community/join/${encodeURIComponent(token)}`
      : null;

  async function copy() {
    if (link) await navigator.clipboard.writeText(link);
  }

  return (
    <Modal open={open} onClose={close} title={t('title')}>
      <div className="space-y-3">
        {!token && (
          <Button onClick={generate} disabled={creating}>
            {creating ? '…' : t('byLink')}
          </Button>
        )}
        {token && link && (
          <>
            <p className="text-sm font-semibold text-slate-700">{t('linkCreated')}</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={link}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
              />
              <Button onClick={copy}>{t('copyLink')}</Button>
            </div>
            <p className="text-xs text-slate-500">{t('linkExpiresIn')}</p>
          </>
        )}
        <div className="pt-2 flex justify-end">
          <button onClick={close} className="text-sm text-slate-500 hover:text-slate-700">
            {t('close')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
