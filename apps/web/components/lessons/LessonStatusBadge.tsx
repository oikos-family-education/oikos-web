'use client';

import { useTranslations } from 'next-intl';
import { getLessonStatusColor, type LessonStatus } from '../../lib/lessonUtils';

const KEY_BY_STATUS: Record<LessonStatus, string> = {
  draft: 'statusDraft',
  scheduled: 'statusScheduled',
  in_progress: 'statusInProgress',
  completed: 'statusCompleted',
  cancelled: 'statusCancelled',
};

export function LessonStatusBadge({ status }: { status: LessonStatus }) {
  const t = useTranslations('Lessons');
  const cls = getLessonStatusColor(status);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {t(KEY_BY_STATUS[status])}
    </span>
  );
}
