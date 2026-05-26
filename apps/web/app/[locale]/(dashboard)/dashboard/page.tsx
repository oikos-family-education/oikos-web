'use client';

import { DashboardHero } from '../../../../components/dashboard/DashboardHero';
import { TodaySchedule } from '../../../../components/dashboard/TodaySchedule';
import { ActiveCurriculums } from '../../../../components/dashboard/ActiveCurriculums';
import { OngoingProjects } from '../../../../components/dashboard/OngoingProjects';
import { NeglectedSubjects } from '../../../../components/dashboard/NeglectedSubjects';
import { DashboardNotes } from '../../../../components/dashboard/DashboardNotes';
import { DashboardJournal } from '../../../../components/dashboard/DashboardJournal';
import { RecentCertificates } from '../../../../components/dashboard/RecentCertificates';
import { DiscoverableBanner } from '../../../../components/community/DiscoverableBanner';

export default function DashboardPage() {
  return (
    <div className="max-w-7xl space-y-6">
      <DashboardHero />
      <DiscoverableBanner />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Today's focus — schedule with inline tick-to-log per child */}
        <div className="lg:col-span-8 space-y-6">
          <TodaySchedule />
        </div>

        {/* Side rail — curricula, projects, and subjects that need attention */}
        <div className="lg:col-span-4 space-y-6">
          <ActiveCurriculums />
          <OngoingProjects />
          <NeglectedSubjects />
        </div>
      </div>

      <DashboardNotes />
      <DashboardJournal />
      <RecentCertificates />
    </div>
  );
}
