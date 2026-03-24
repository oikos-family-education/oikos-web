'use client';

import { Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PlaceholderPage } from '../../../../components/dashboard/PlaceholderPage';

export default function CalendarPage() {
  const t = useTranslations('Placeholder');
  const tNav = useTranslations('Navigation');
  return <PlaceholderPage title={tNav('calendar')} description={t('calendarDesc')} icon={Calendar} />;
}
