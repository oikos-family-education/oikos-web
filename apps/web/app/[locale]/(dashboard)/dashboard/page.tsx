'use client';

import { WelcomeSection } from '../../../../components/dashboard/WelcomeSection';
import { NavigationCards } from '../../../../components/dashboard/NavigationCards';

export default function DashboardPage() {
  return (
    <div className="max-w-5xl">
      <WelcomeSection />
      <NavigationCards />
    </div>
  );
}
