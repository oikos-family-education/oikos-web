import { Suspense } from 'react';
import { FamilyPageClient } from '../../../../components/family/FamilyPageClient';

export default function FamilyPage() {
  return (
    <Suspense>
      <FamilyPageClient />
    </Suspense>
  );
}
