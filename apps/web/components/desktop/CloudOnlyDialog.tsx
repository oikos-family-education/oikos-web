'use client';

import React from 'react';
import { Cloud } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';
import { Modal } from '../dashboard/Modal';

interface CloudOnlyDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CloudOnlyDialog({ open, onClose }: CloudOnlyDialogProps) {
  const t = useTranslations('Desktop');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('cloudOnlyTitle')}
      footer={<Button type="button" onClick={onClose}>{t('cloudOnlyOk')}</Button>}
    >
      <div className="flex items-start gap-4">
        <span className="inline-flex p-3 rounded-2xl bg-primary/10 flex-shrink-0">
          <Cloud className="w-5 h-5 text-primary" />
        </span>
        <p className="text-slate-600">{t('cloudOnlyBody')}</p>
      </div>
    </Modal>
  );
}
