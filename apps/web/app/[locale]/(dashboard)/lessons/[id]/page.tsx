'use client';

import { useParams } from 'next/navigation';
import { LessonEditor } from '../../../../../components/lessons/LessonEditor';

export default function Page() {
  const params = useParams<{ id: string }>();
  return <LessonEditor lessonId={params?.id || null} />;
}
