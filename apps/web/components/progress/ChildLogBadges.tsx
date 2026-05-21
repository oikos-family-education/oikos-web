'use client';

import React from 'react';
import { Check, Loader2, Users } from 'lucide-react';
import type { useDayLogs } from '../../hooks/useDayLogs';

export interface ChildLogBadgesProps {
  subjectId: string;
  subjectName: string;
  /** Children involved in this subject for this day; rendered in order. */
  kids: { id: string; name: string }[];
  /** Minutes to record when a tick creates a log. For planner-driven rows this
   * is the routine duration; for curriculum-driven rows it's the curriculum
   * subject's session_duration_minutes. */
  durationMinutes: number;
  todayLogs: ReturnType<typeof useDayLogs>;
  /** Optional labels for accessibility — falls back to English. */
  labels?: {
    tick?: (vars: { child: string; subject: string }) => string;
    untick?: (vars: { child: string; subject: string }) => string;
  };
  /** Hide the Users icon prefix (smaller, denser layouts). */
  hideUsersIcon?: boolean;
}

/**
 * The interactive child-initial badges used in both the dashboard's Today
 * widget and the /progress LogTab day checklist. Each child becomes a tap
 * target: tap once to mark (child × subject) as taught for the active day,
 * tap again to unmark.
 */
export function ChildLogBadges({
  subjectId,
  subjectName,
  kids,
  durationMinutes,
  todayLogs,
  labels,
  hideUsersIcon,
}: ChildLogBadgesProps) {
  if (!kids.length) return null;
  const tickLabel =
    labels?.tick ?? (({ child, subject }) => `Mark ${subject} as taught for ${child}`);
  const untickLabel =
    labels?.untick ?? (({ child, subject }) => `Unmark ${subject} for ${child}`);

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {!hideUsersIcon && <Users className="h-3 w-3 text-slate-400" aria-hidden />}
      <div className="flex flex-wrap gap-1 justify-end max-w-[150px] sm:max-w-[200px]">
        {kids.map((child) => {
          const logged = todayLogs.isLogged(child.id, subjectId);
          const busy = todayLogs.isBusy(child.id, subjectId);
          return (
            <button
              key={child.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                todayLogs.toggle(child.id, subjectId, durationMinutes);
              }}
              disabled={busy || !!todayLogs.fanout}
              aria-pressed={logged}
              aria-label={
                logged
                  ? untickLabel({ child: child.name, subject: subjectName })
                  : tickLabel({ child: child.name, subject: subjectName })
              }
              title={
                logged
                  ? untickLabel({ child: child.name, subject: subjectName })
                  : tickLabel({ child: child.name, subject: subjectName })
              }
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold transition-all disabled:opacity-50 ${
                logged
                  ? 'border-success bg-success text-white hover:bg-success/90 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-primary/50 hover:bg-primary/10 hover:text-primary hover:shadow-sm'
              }`}
            >
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : logged ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <span aria-hidden>{child.name.charAt(0).toUpperCase()}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
