'use client';

import React, { useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ChildData, DAY_NAMES, RoutineEntryData, SubjectData } from './types';
import { buildDaySchedule } from './dayView';
import { DayAgendaTable, DayResource } from './DayAgendaTable';
import { FamilyParent } from '../../hooks/useFamilyParents';
import { ShieldPreview } from '../onboarding/ShieldPreview';
import type { ShieldConfig } from '../onboarding/ShieldBuilder';

interface PrintableDayPlannerProps {
  entries: RoutineEntryData[];
  subjects: SubjectData[];
  childrenList: ChildData[];
  dayIndex: number;
  parentsById: Record<string, FamilyParent>;
  resourcesBySubject: Record<string, DayResource[]>;
  templateName?: string;
  familyName?: string;
  shieldConfig?: ShieldConfig | null;
}

export function PrintableDayPlanner({
  entries,
  subjects,
  childrenList,
  dayIndex,
  parentsById,
  resourcesBySubject,
  templateName,
  familyName,
  shieldConfig,
}: PrintableDayPlannerProps) {
  const t = useTranslations('WeekPlanner');
  const schedule = useMemo(
    () => buildDaySchedule(entries, childrenList, dayIndex),
    [entries, childrenList, dayIndex],
  );
  const subjectsById = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);
  const dayName = t(DAY_NAMES[dayIndex]);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#1e293b', padding: '4mm 2mm' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BookOpen style={{ width: 16, height: 16, color: 'white' }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Oikos</span>
          <span style={{ color: '#cbd5e1', fontSize: 14 }}>·</span>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#334155' }}>
            {templateName ? `${templateName} — ` : ''}{dayName}
          </h2>
        </div>
        {shieldConfig && familyName && (
          <ShieldPreview config={shieldConfig} familyName={familyName} showFamilyName={false} width={40} height={48} />
        )}
      </div>

      {schedule.rows.length === 0 ? (
        <p style={{ fontSize: 12 }}>{t('dayViewEmpty', { day: dayName })}</p>
      ) : (
        <DayAgendaTable
          schedule={schedule}
          subjectsById={subjectsById}
          parentsById={parentsById}
          resourcesBySubject={resourcesBySubject}
          childrenList={childrenList}
          variant="print"
        />
      )}
    </div>
  );
}
