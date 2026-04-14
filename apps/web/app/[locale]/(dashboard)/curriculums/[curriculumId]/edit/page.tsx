'use client';

import { useParams } from 'next/navigation';
import { CurriculumWizard } from '../../../../../../components/curriculums/CurriculumWizard';

export default function EditCurriculumPage() {
  const params = useParams();
  const curriculumId = params.curriculumId as string;

  return <CurriculumWizard curriculumId={curriculumId} />;
}
