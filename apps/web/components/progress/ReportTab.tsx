'use client';

import React from 'react';
import { Loader2, Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '../../lib/navigation';
import { PrintableReport } from './PrintableReport';
import { useProgressReport } from '../../hooks/useProgressReport';

interface ReportTabProps {
  from: string;
  to: string;
  childId?: string | null;
}

export function ReportTab({ from, to, childId }: ReportTabProps) {
  const t = useTranslations('Progress');
  const router = useRouter();
  const { data, isLoading, error } = useProgressReport(from, to, childId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <p className="text-sm text-red-500">{error ?? t('genericError')}</p>
      </div>
    );
  }

  function openPrintView() {
    const params = new URLSearchParams({ from, to });
    if (childId) params.set('child_id', childId);
    router.push(`/progress/report?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{t('reportPreviewTitle')}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{t('reportPreviewHint')}</p>
        </div>
        <button
          onClick={openPrintView}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm whitespace-nowrap"
        >
          <Printer className="w-4 h-4" />
          {t('printReport')}
        </button>
      </div>

      <div className="bg-slate-100 rounded-xl p-4 sm:p-6 overflow-x-auto">
        <div className="mx-auto" style={{ maxWidth: '210mm' }}>
          <PrintableReport report={data} />
        </div>
      </div>
    </div>
  );
}
