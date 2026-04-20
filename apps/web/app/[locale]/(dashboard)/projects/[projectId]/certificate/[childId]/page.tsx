'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { ShieldPreview } from '../../../../../../../components/onboarding/ShieldPreview';
import type { ShieldConfig } from '../../../../../../../components/onboarding/ShieldBuilder';

interface CertificateData {
  child_name: string;
  family_name: string;
  shield_config: ShieldConfig | null;
  project_title: string;
  project_purpose: string | null;
  completed_at: string | null;
  certificate_number: string;
  subjects: string[];
}

export default function CertificatePage() {
  const t = useTranslations('Projects');
  const params = useParams();
  const projectId = params.projectId as string;
  const childId = params.childId as string;

  const [data, setData] = useState<CertificateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const certRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    if (!certRef.current) return;
    const cert = certRef.current;
    const originalParent = cert.parentNode;
    const placeholder = document.createComment('cert-placeholder');
    // Move cert node to be a direct child of <body> so print CSS can isolate it
    originalParent?.insertBefore(placeholder, cert);
    document.body.appendChild(cert);
    document.body.classList.add('printing-cert');

    const cleanup = () => {
      document.body.classList.remove('printing-cert');
      placeholder.parentNode?.insertBefore(cert, placeholder);
      placeholder.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // Fallback in case afterprint doesn't fire (some browsers)
    setTimeout(cleanup, 60000);

    window.print();
  }

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/v1/projects/${projectId}/certificate/${childId}`, {
        credentials: 'include',
      });
      if (res.ok) setData(await res.json());
      setIsLoading(false);
    }
    load();
  }, [projectId, childId]);

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const completedDate = data.completed_at
    ? new Date(data.completed_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const subjectLine = data.subjects.length > 0
    ? t('certificateSubjects', { subjects: data.subjects.join(' & ') })
    : null;

  const purposeLine = data.project_purpose
    ? t('certificatePurpose', { purpose: data.project_purpose })
    : null;

  const hasCoatOfArms = !!data.shield_config;

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #FAF7F0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* When the print button is clicked, the cert div is moved to be a direct
             child of <body>. Hide every OTHER direct child of body so only the
             certificate renders, and force it to exactly one A4 page. */
          body.printing-cert > *:not(.cert-print-root) {
            display: none !important;
          }
          body.printing-cert .cert-print-root {
            width: 210mm !important;
            height: 297mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
          }
        }

        /* Certificate fonts */
        .cert-serif {
          font-family: 'Palatino Linotype', 'Palatino', 'Georgia', 'Times New Roman', serif;
        }
      `}</style>

      {/* Print button (screen only) */}
      <div className="print:hidden max-w-5xl mb-6 flex justify-end">
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium text-sm"
        >
          <Printer className="w-4 h-4" />
          {t('printCertificate')}
        </button>
      </div>

      {/* Certificate */}
      <div id="certificate-root" className="flex items-center justify-center print:p-0">
        <div
          ref={certRef}
          className="cert-print-root cert-serif w-[210mm] h-[297mm] p-[15mm] relative overflow-hidden"
          style={{ backgroundColor: '#FAF7F0' }}
        >
          {/* Decorative border */}
          <div
            className="absolute inset-[10mm] pointer-events-none"
            style={{
              border: '2px solid #1A3828',
              boxShadow: 'inset 0 0 0 4px #FAF7F0, inset 0 0 0 5px #1A3828',
            }}
          >
            {/* Corner ornaments */}
            <svg className="absolute -top-1 -left-1 w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path d="M2 2 L2 12 Q2 2 12 2" stroke="#1A3828" strokeWidth="2" fill="none" />
            </svg>
            <svg className="absolute -top-1 -right-1 w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path d="M22 2 L22 12 Q22 2 12 2" stroke="#1A3828" strokeWidth="2" fill="none" />
            </svg>
            <svg className="absolute -bottom-1 -left-1 w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path d="M2 22 L2 12 Q2 22 12 22" stroke="#1A3828" strokeWidth="2" fill="none" />
            </svg>
            <svg className="absolute -bottom-1 -right-1 w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path d="M22 22 L22 12 Q22 22 12 22" stroke="#1A3828" strokeWidth="2" fill="none" />
            </svg>
          </div>

          {/* Content area */}
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[267mm] px-[20mm] text-center">
            {/* Seals row */}
            <div className={`flex items-center mb-10 ${hasCoatOfArms ? 'justify-between w-full' : 'justify-center'}`}>
              {hasCoatOfArms && (
                <ShieldPreview
                  config={data.shield_config!}
                  familyName={data.family_name}
                  showMotto={true}
                  width={110}
                  height={130}
                />
              )}
              {/* Oikos seal */}
              <div className="flex flex-col items-center">
                <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="30" cy="30" r="28" stroke="#1A3828" strokeWidth="2" />
                  <circle cx="30" cy="30" r="24" stroke="#1A3828" strokeWidth="1" />
                  {/* House with open book */}
                  <path d="M30 14 L44 26 L42 26 L42 40 L18 40 L18 26 L16 26 Z" stroke="#1A3828" strokeWidth="1.5" fill="none" />
                  <path d="M25 40 L25 30 L35 30 L35 40" stroke="#1A3828" strokeWidth="1.5" fill="none" />
                  {/* Book */}
                  <path d="M24 33 L30 35 L36 33" stroke="#1A3828" strokeWidth="1" fill="none" />
                  <path d="M24 35 L30 37 L36 35" stroke="#1A3828" strokeWidth="1" fill="none" />
                </svg>
                <span className="cert-serif text-xs mt-1" style={{ color: '#1A3828', letterSpacing: '0.15em' }}>
                  OIKOS
                </span>
              </div>
            </div>

            {/* Title */}
            <h1
              className="cert-serif text-2xl tracking-widest uppercase mb-12"
              style={{ color: '#1A3828' }}
            >
              {t('certificateTitle')}
            </h1>

            {/* Body */}
            <p className="cert-serif text-base mb-4" style={{ color: '#333' }}>
              {t('certificateBody')}
            </p>

            {/* Child's name */}
            <h2 className="cert-serif text-4xl font-normal mb-6" style={{ color: '#000' }}>
              {data.child_name}
            </h2>

            {/* Completed the */}
            <p className="cert-serif text-base mb-4" style={{ color: '#333' }}>
              {t('certificateCompleted')}
            </p>

            {/* Project title */}
            <h3 className="cert-serif text-2xl font-normal mb-4" style={{ color: '#000' }}>
              {data.project_title}
            </h3>

            {/* Subjects */}
            {subjectLine && (
              <p className="cert-serif text-sm italic mb-3" style={{ color: '#555' }}>
                {subjectLine}
              </p>
            )}

            {/* Purpose */}
            {purposeLine && (
              <p className="cert-serif text-sm italic mb-6" style={{ color: '#555' }}>
                &ldquo;{purposeLine}&rdquo;
              </p>
            )}

            {/* Completion date */}
            <p className="cert-serif text-base mb-14" style={{ color: '#333' }}>
              {t('certificateCompletedOn', { date: completedDate })}
            </p>

            {/* Signature area */}
            <div className="flex items-start justify-between w-full max-w-[140mm] mt-auto">
              <div className="text-center flex flex-col items-center">
                <div className="w-48" style={{ borderBottom: '1px solid #1A3828' }} />
                <p className="cert-serif text-xs mt-1" style={{ color: '#666' }}>
                  {data.family_name}
                </p>
                <p className="cert-serif text-xs" style={{ color: '#999' }}>
                  {t('certificateParent')}
                </p>
              </div>
              <div className="text-center flex flex-col items-center">
                <p className="cert-serif text-xs" style={{ color: '#666' }}>
                  {t('certificateNumber')}
                </p>
                <p className="cert-serif text-sm font-normal mt-1" style={{ color: '#1A3828' }}>
                  {data.certificate_number}
                </p>
              </div>
              <div className="text-center flex flex-col items-center">
                <div className="w-48" style={{ borderBottom: '1px solid #1A3828' }} />
                <p className="cert-serif text-xs mt-1" style={{ color: '#666' }}>
                  {completedDate}
                </p>
                <p className="cert-serif text-xs" style={{ color: '#999' }}>
                  {t('certificateDateLine')}
                </p>
              </div>
            </div>

            {/* Footer decorative rule */}
            <div className="mt-8 w-full flex justify-center">
              <div className="w-48" style={{ borderTop: '1px solid #1A3828' }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
