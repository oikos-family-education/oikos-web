'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { RoutineProjectionBlock as Block, HOURS_START, ROW_HEIGHT } from './types';

interface RoutineProjectionBlockProps {
  block: Block;
  column?: number;
  columns?: number;
}

export function RoutineProjectionBlockView({
  block,
  column = 0,
  columns = 1,
}: RoutineProjectionBlockProps) {
  const t = useTranslations('Calendar');
  const startHours = block.start_minute / 60;
  const top = (startHours - HOURS_START) * ROW_HEIGHT;
  const height = (block.duration_minutes / 60) * ROW_HEIGHT;

  if (top < 0 || top > (22 - HOURS_START) * ROW_HEIGHT) return null;

  const label = block.is_free_time
    ? 'Free time'
    : block.subject_name || 'Custom';

  const widthPct = 100 / columns;
  const leftPct = column * widthPct;

  return (
    <div
      className="absolute rounded opacity-40 border border-slate-300"
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 20)}px`,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        backgroundColor: block.color ? `${block.color}40` : '#cbd5e140',
      }}
      title={`${t('routineTooltip')}`}
    >
      <div className="text-[10px] text-slate-600 px-1 truncate">{label}</div>
    </div>
  );
}
