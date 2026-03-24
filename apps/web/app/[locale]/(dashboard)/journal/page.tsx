'use client';

import { PenTool } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PlaceholderPage } from '../../../../components/dashboard/PlaceholderPage';

export default function JournalPage() {
  const t = useTranslations('Placeholder');
  const tNav = useTranslations('Navigation');
  return <PlaceholderPage title={tNav('journal')} description={t('journalDesc')} icon={PenTool} />;
}
