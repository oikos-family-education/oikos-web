'use client';

import { DashboardHero } from '../../../../components/dashboard/DashboardHero';
import { TodaySchedule } from '../../../../components/dashboard/TodaySchedule';
import { ActiveCurriculums } from '../../../../components/dashboard/ActiveCurriculums';
import { OngoingProjects } from '../../../../components/dashboard/OngoingProjects';
import { ProgressWidget } from '../../../../components/dashboard/ProgressWidget';
import { NeglectedSubjects } from '../../../../components/dashboard/NeglectedSubjects';
import { DashboardNotes } from '../../../../components/dashboard/DashboardNotes';
import { DashboardJournal } from '../../../../components/dashboard/DashboardJournal';
import { RecentCertificates } from '../../../../components/dashboard/RecentCertificates';

export default function DashboardPage() {
  return (
    <div className="max-w-7xl space-y-6">
      <DashboardHero />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column — today's focus */}
        <div className="lg:col-span-5">
          <TodaySchedule />
        </div>

        {/* Middle column — curriculum + projects */}
        <div className="lg:col-span-4 space-y-6">
          <ActiveCurriculums />
          <OngoingProjects />
        </div>

        {/* Right column — progress + gaps */}
        <div className="lg:col-span-3 space-y-6">
          <ProgressWidget />
          <NeglectedSubjects />
        </div>
      </div>

      <DashboardNotes />
      <DashboardJournal />
      <RecentCertificates />
    </div>
  );
}
