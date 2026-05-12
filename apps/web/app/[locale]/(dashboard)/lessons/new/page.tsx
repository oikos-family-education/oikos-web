'use client';

import { useSearchParams } from 'next/navigation';
import { LessonEditor } from '../../../../../components/lessons/LessonEditor';

export default function Page() {
  const params = useSearchParams();
  const date = params.get('date') || undefined;
  return <LessonEditor lessonId={null} defaultDateISO={date} />;
}
