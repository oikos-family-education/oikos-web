'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '../../../../../lib/navigation';
import { PrintableReport } from '../../../../../components/progress/PrintableReport';
import { useProgressReport } from '../../../../../hooks/useProgressReport';

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ProgressReportPage() {
  const t = useTranslations('Progress');
  const router = useRouter();
  const params = useSearchParams();
  const sheetRef = useRef<HTMLDivElement>(null);

  const { from, to, childId } = useMemo(() => {
    const today = new Date();
    const defaultTo = isoDate(today);
    const defFrom = new Date(today);
    defFrom.setDate(defFrom.getDate() - 29);
    return {
      from: params.get('from') ?? isoDate(defFrom),
      to: params.get('to') ?? defaultTo,
      childId: params.get('child_id'),
    };
  }, [params]);

  const { data, isLoading, error } = useProgressReport(from, to, childId);

  useEffect(() => {
    return () => {
      document.body.classList.remove('printing-report');
    };
  }, []);

  function handlePrint() {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const originalParent = sheet.parentNode;
    const placeholder = document.createComment('report-placeholder');
    originalParent?.insertBefore(placeholder, sheet);
    document.body.appendChild(sheet);
    document.body.classList.add('printing-report');

    const cleanup = () => {
      document.body.classList.remove('printing-report');
      placeholder.parentNode?.insertBefore(sheet, placeholder);
      placeholder.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 60000);

    window.print();
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-red-500">{error ?? t('genericError')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="print:hidden flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/progress')}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('reportBackToProgress')}
        </button>
        <button
          onClick={handlePrint}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm whitespace-nowrap"
        >
          <Printer className="w-4 h-4" />
          {t('printReport')}
        </button>
      </div>

      <div className="bg-slate-100 rounded-xl p-4 sm:p-6 print:bg-white print:p-0">
        <PrintableReport ref={sheetRef} report={data} />
      </div>
    </>
  );
}
