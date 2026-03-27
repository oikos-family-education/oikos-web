'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@oikos/ui';

interface SaveRoutineDialogProps {
  onSave: (name: string) => void;
  onClose: () => void;
}

export function SaveRoutineDialog({ onSave, onClose }: SaveRoutineDialogProps) {
  const t = useTranslations('WeekPlanner');
  const [name, setName] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm mx-4"
        onMouseDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">{t('saveRoutine')}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-slate-500">{t('saveRoutineDescription')}</p>

          <div>
            <label className="text-sm font-semibold text-slate-700">{t('saveRoutineName')}</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('saveRoutineNamePlaceholder')}
              className="mt-1 block w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              {t('cancel')}
            </button>
            <Button type="submit" disabled={!name.trim()}>
              {t('saveRoutine')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
