'use client';

import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PlaceholderPage } from '../../../../components/dashboard/PlaceholderPage';

export default function CommunityPage() {
  const t = useTranslations('Placeholder');
  const tNav = useTranslations('Navigation');
  return <PlaceholderPage title={tNav('community')} description={t('communityDesc')} icon={Globe} />;
}
