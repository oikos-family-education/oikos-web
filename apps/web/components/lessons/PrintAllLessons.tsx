'use client';

import React from 'react';
import {
  BookOpen, Calendar as CalendarIcon, Clock, Hash,
  icons as lucideIcons,
} from 'lucide-react';
import {
  formatLessonIdentifier,
  type LessonSummary,
} from '../../lib/lessonUtils';
import { ShieldPreview } from '../onboarding/ShieldPreview';
import type { ShieldConfig } from '../onboarding/ShieldBuilder';

interface PrintAllLessonsProps {
  lessons: LessonSummary[];
  family: {
    family_name: string;
    shield_config: Record<string, string> | null;
  } | null;
}

/**
 * Hidden on screen, shown in print when body has `printing-all-lessons` class.
 * Renders each lesson on its own page with the same Oikos-branded header
 * used by the single-lesson print flow.
 */
export function PrintAllLessons({ lessons, family }: PrintAllLessonsProps) {
  return (
    <div className="print-all-lessons hidden">
      {lessons.map((lesson, idx) => (
        <LessonPrintPage
          key={lesson.id}
          lesson={lesson}
          family={family}
          isLast={idx === lessons.length - 1}
        />
      ))}
    </div>
  );
}

function LessonPrintPage({
  lesson, family, isLast,
}: {
  lesson: LessonSummary;
  family: PrintAllLessonsProps['family'];
  isLast: boolean;
}) {
  const subjectColor = lesson.subject.color || '#6366f1';
  const subjectIcon = lesson.subject.icon;
  const identifier = formatLessonIdentifier(
    lesson.subject.name, lesson.sequence_number, lesson.reference_number,
  );

  return (
    <article className={`lesson-print-page ${isLast ? 'is-last' : ''}`}>
      {/* Oikos brand + family shield header */}
      <div className="lesson-print-header flex items-center justify-between mb-6 pb-4 border-b border-slate-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-indigo-500 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xl font-bold text-slate-800 leading-none">Oikos</p>
            <p className="text-xs text-slate-500 mt-1">Family Education Platform</p>
          </div>
        </div>
        {family?.shield_config ? (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-800 leading-tight">{family.family_name}</p>
            </div>
            <ShieldPreview
              config={family.shield_config as unknown as ShieldConfig}
              familyName={family.family_name}
              width={56}
              height={56}
              showMotto={false}
            />
          </div>
        ) : null}
      </div>

      {/* Lesson meta header */}
      <div className="mb-4">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border mb-2"
          style={{
            backgroundColor: `${subjectColor}1a`,
            color: subjectColor,
            borderColor: `${subjectColor}33`,
          }}
        >
          <SubjectIconInline name={subjectIcon} />
          {lesson.subject.name}
        </span>
        <h1 className="text-2xl font-bold text-slate-800">{lesson.title}</h1>
        <p className="text-sm text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 font-medium text-slate-600">
            <Hash className="w-3 h-3" aria-hidden /> {identifier}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="w-3 h-3" aria-hidden /> {lesson.scheduled_for}
          </span>
          {lesson.estimated_duration_minutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" aria-hidden /> {lesson.estimated_duration_minutes} min
            </span>
          ) : null}
        </p>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div
          className="rte-content text-sm text-slate-800"
          dangerouslySetInnerHTML={{ __html: lesson.content_html || '' }}
        />
      </div>
    </article>
  );
}

function SubjectIconInline({ name }: { name: string | null }) {
  const key = name && name in lucideIcons ? (name as keyof typeof lucideIcons) : null;
  if (key) {
    return React.createElement(lucideIcons[key], {
      className: 'w-3.5 h-3.5',
      'aria-hidden': true,
    });
  }
  return <BookOpen className="w-3.5 h-3.5" aria-hidden />;
}
