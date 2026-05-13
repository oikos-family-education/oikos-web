import { Suspense } from 'react';
import { SettingsPageClient } from '../../../../components/settings/SettingsPageClient';

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageClient />
    </Suspense>
  );
}
