'use client';

import { BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PlaceholderPage } from '../../../../components/dashboard/PlaceholderPage';

export default function DisciplinesPage() {
  const t = useTranslations('Placeholder');
  const tNav = useTranslations('Navigation');
  return <PlaceholderPage title={tNav('disciplines')} description={t('disciplinesDesc')} icon={BookOpen} />;
}
