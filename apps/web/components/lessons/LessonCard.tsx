'use client';

import { Clock, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '../../lib/navigation';
import {
  formatDuration,
  type LessonSummary,
} from '../../lib/lessonUtils';
import { LessonStatusBadge } from './LessonStatusBadge';

export function LessonCard({ lesson }: { lesson: LessonSummary }) {
  const t = useTranslations('Lessons');
  const accent = lesson.subject.color || '#6366f1';
  const childCount = lesson.subject.child_ids.length;

  return (
    <Link
      href={`/lessons/${lesson.id}`}
      className="flex items-stretch gap-3 rounded-lg border border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm transition-all"
      aria-label={t('openLesson')}
    >
      <span
        className="w-1 rounded-l-lg flex-shrink-0"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <div className="flex flex-col gap-1 px-3 py-2.5 flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate flex-1">
            {lesson.title}
          </p>
          <LessonStatusBadge status={lesson.status} />
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="truncate font-medium">{lesson.subject.name}</span>
          {lesson.estimated_duration_minutes ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Clock className="h-3 w-3" aria-hidden />
              {formatDuration(lesson.estimated_duration_minutes)}
            </span>
          ) : null}
          {childCount > 0 ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <Users className="h-3 w-3" aria-hidden />
              {childCount}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
