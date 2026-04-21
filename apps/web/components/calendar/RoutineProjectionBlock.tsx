'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { RoutineProjectionBlock as Block, HOURS_START, ROW_HEIGHT } from './types';

interface RoutineProjectionBlockProps {
  block: Block;
}

export function RoutineProjectionBlockView({ block }: RoutineProjectionBlockProps) {
  const t = useTranslations('Calendar');
  const startHours = block.start_minute / 60;
  const top = (startHours - HOURS_START) * ROW_HEIGHT;
  const height = (block.duration_minutes / 60) * ROW_HEIGHT;

  if (top < 0 || top > (22 - HOURS_START) * ROW_HEIGHT) return null;

  const label = block.is_free_time
    ? 'Free time'
    : block.subject_name || 'Custom';

  return (
    <div
      className="absolute left-0.5 right-0.5 rounded opacity-40 border border-slate-300"
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 20)}px`,
        backgroundColor: block.color ? `${block.color}40` : '#cbd5e140',
      }}
      title={`${t('routineTooltip')}`}
    >
      <div className="text-[10px] text-slate-600 px-1 truncate">{label}</div>
    </div>
  );
}
