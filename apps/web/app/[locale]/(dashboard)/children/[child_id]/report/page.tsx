'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, FileText, Loader2, Printer } from 'lucide-react';
import { Button } from '@oikos/ui';
import { apiFetch } from '../../../../../../lib/apiFetch';
import { useRouter } from '../../../../../../lib/navigation';
import { useAuth } from '../../../../../../providers/AuthProvider';
import { getChildDisplayName } from '../../../../../../lib/childDisplay';
import { HighlightsManager } from '../../../../../../components/children/report/HighlightsManager';
import { ChildReportSheet } from '../../../../../../components/children/report/ChildReportSheet';
import {
  ChildReport,
  DEFAULT_SECTIONS,
  REPORT_SECTIONS,
  ReportSection,
} from '../../../../../../components/children/report/types';

const PAGE_STYLE_ID = 'child-report-page-style';
// Top/bottom, left/right margins on every printed page
const PRINT_PAGE_MARGIN = '16mm 14mm';

export default function ChildReportPage() {
  const params = useParams();
  const childId = params.child_id as string;
  const router = useRouter();
  const t = useTranslations('ChildReport');
  const { user } = useAuth();
  const dateFormat = user?.date_format || 'MM/DD/YYYY';
  const sheetRef = useRef<HTMLDivElement>(null);

  const [childName, setChildName] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sections, setSections] = useState<Set<ReportSection>>(new Set(DEFAULT_SECTIONS));
  const [report, setReport] = useState<ChildReport | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  // The first fetch (no dates) tells us the default period: the active curriculum's span
  useEffect(() => {
    async function init() {
      const res = await apiFetch(`/api/v1/children/${childId}/report`, { credentials: 'include' });
      if (res.status === 404) {
        setNotFound(true);
      } else if (res.ok) {
        const data: ChildReport = await res.json();
        setChildName(getChildDisplayName(data.child));
        setFromDate(data.range.from_date);
        setToDate(data.range.to_date);
      } else {
        setError(t('loadError'));
      }
      setInitialLoading(false);
    }
    init();
  }, [childId, t]);

  useEffect(() => {
    return () => {
      document.body.classList.remove('printing-report', 'printing-child-report');
      document.getElementById(PAGE_STYLE_ID)?.remove();
    };
  }, []);

  const generate = useCallback(async () => {
    if (!fromDate || !toDate) return;
    if (fromDate > toDate) {
      setError(t('rangeError'));
      return;
    }
    setGenerating(true);
    setError('');
    const res = await apiFetch(
      `/api/v1/children/${childId}/report?from=${fromDate}&to=${toDate}`,
      { credentials: 'include' },
    );
    if (res.ok) {
      setReport(await res.json());
    } else {
      setError(t('loadError'));
    }
    setGenerating(false);
  }, [childId, fromDate, toDate, t]);

  // Keep a generated report in sync when highlights change
  const handleHighlightsChanged = useCallback(() => {
    if (report) generate();
  }, [report, generate]);

  function toggleSection(section: ReportSection) {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  function handlePrint() {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const originalParent = sheet.parentNode;
    const placeholder = document.createComment('report-placeholder');
    originalParent?.insertBefore(placeholder, sheet);
    document.body.appendChild(sheet);
    document.body.classList.add('printing-report', 'printing-child-report');

    // The app-wide print rule sets `@page { margin: 0 }`, so a multi-page report
    // would run edge to edge after page one. Give every page real margins for
    // this print only (a later @page rule wins over the global one).
    const pageStyle = document.createElement('style');
    pageStyle.id = PAGE_STYLE_ID;
    pageStyle.textContent = `@media print { @page { size: A4; margin: ${PRINT_PAGE_MARGIN}; } }`;
    document.head.appendChild(pageStyle);

    const cleanup = () => {
      document.body.classList.remove('printing-report', 'printing-child-report');
      pageStyle.remove();
      placeholder.parentNode?.insertBefore(sheet, placeholder);
      placeholder.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 60000);

    window.print();
  }

  if (initialLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return <div className="max-w-5xl text-center py-20 text-slate-500">{t('childNotFound')}</div>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="print:hidden space-y-6">
        <button
          onClick={() => router.push(`/children/${childId}`)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('backToChild', { name: childName })}
        </button>

        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('pageTitle', { name: childName })}</h1>
          <p className="text-slate-500 mt-1">{t('pageSubtitle')}</p>
        </div>

        {/* Period — drives both the highlights list and the report */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">{t('periodTitle')}</h2>
          <p className="text-sm text-slate-500 mb-4">{t('periodHint')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="report-from" className="text-sm font-semibold text-slate-700">
                {t('fromLabel')}
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                id="report-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="report-to" className="text-sm font-semibold text-slate-700">
                {t('toLabel')}
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <input
                id="report-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Step 1: highlights */}
        {fromDate && toDate && fromDate <= toDate && (
          <HighlightsManager
            childId={childId}
            childName={childName}
            fromDate={fromDate}
            toDate={toDate}
            dateFormat={dateFormat}
            onChanged={handleHighlightsChanged}
          />
        )}

        {/* Step 2: choose sections and generate */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">{t('sectionsTitle')}</h2>
          <p className="text-sm text-slate-500 mb-4">{t('sectionsHint')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
            {REPORT_SECTIONS.map((s) => (
              <label key={s} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sections.has(s)}
                  onChange={() => toggleSection(s)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span>
                  {t(`include_${s}`)}
                  {s === 'support' && <span className="block text-xs text-slate-500">{t('include_supportHint')}</span>}
                </span>
              </label>
            ))}
          </div>
          {error && <p className="text-xs font-medium text-red-500 mb-3">{error}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            {report && (
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium text-sm whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                {t('printReport')}
              </button>
            )}
            <Button type="button" onClick={generate} disabled={generating || !fromDate || !toDate} className="px-5">
              {generating ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  {report ? t('regenerateReport') : t('generateReport')}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Step 3: the report */}
      {report && (
        <div className="bg-slate-100 rounded-xl p-4 sm:p-6 print:bg-white print:p-0">
          <ChildReportSheet ref={sheetRef} report={report} sections={sections} dateFormat={dateFormat} />
        </div>
      )}
    </div>
  );
}
