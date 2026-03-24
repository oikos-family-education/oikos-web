'use client';

import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PlaceholderPage } from '../../../../components/dashboard/PlaceholderPage';

export default function FamilyPage() {
  const t = useTranslations('Placeholder');
  const tNav = useTranslations('Navigation');
  return <PlaceholderPage title={tNav('family')} description={t('familyDesc')} icon={Users} />;
}
