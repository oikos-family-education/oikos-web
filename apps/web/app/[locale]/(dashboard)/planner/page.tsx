'use client';

import { LayoutGrid } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PlaceholderPage } from '../../../../components/dashboard/PlaceholderPage';

export default function PlannerPage() {
  const t = useTranslations('Placeholder');
  const tNav = useTranslations('Navigation');
  return <PlaceholderPage title={tNav('planner')} description={t('plannerDesc')} icon={LayoutGrid} />;
}
