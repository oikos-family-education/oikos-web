'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';

interface ArchiveModalProps {
  childName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ArchiveModal({ childName, onConfirm, onCancel }: ArchiveModalProps) {
  const t = useTranslations('Children');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30" onClick={onCancel} />
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 relative z-10">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">
          {t('archiveTitle', { name: childName })}
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          {t('archiveBody', { name: childName })}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
          >
            {t('cancel')}
          </button>
          <Button
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white"
          >
            {t('archiveConfirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
