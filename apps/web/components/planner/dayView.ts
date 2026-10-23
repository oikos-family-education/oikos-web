import { ChildData, GridConfig, RoutineEntryData, visibleDayIndices } from './types';

// Column id for entries scheduled without any child (e.g. family free time)
export const FAMILY_COLUMN_ID = '__family__';

export interface DayColumn {
  id: string; // child id, or FAMILY_COLUMN_ID
  child: ChildData | null;
}

export interface DayRow {
  startMinute: number;
  // column id -> entries starting at this minute for that column
  cells: Record<string, RoutineEntryData[]>;
}

export interface DaySchedule {
  columns: DayColumn[];
  rows: DayRow[];
}

/** Day index (0=Monday) to open the day view on: today when visible, else the first visible day. */
export function defaultDayIndex(config: GridConfig, now: Date = new Date()): number {
  const days = visibleDayIndices(config);
  const today = (now.getDay() + 6) % 7;
  return days.includes(today) ? today : days[0];
}

/** Move to the previous/next visible day, wrapping around the week. */
export function stepDayIndex(config: GridConfig, current: number, direction: 1 | -1): number {
  const days = visibleDayIndices(config);
  const pos = days.indexOf(current);
  if (pos === -1) return days[0];
  return days[(pos + direction + days.length) % days.length];
}

/**
 * Lays out one day as a table: one column per active child (plus a family
 * column when something is scheduled for nobody in particular) and one row
 * per distinct start time, so the same time lines up across children.
 * An entry shared by several children appears in each of their columns.
 */
export function buildDaySchedule(
  entries: RoutineEntryData[],
  childrenList: ChildData[],
  dayIndex: number,
): DaySchedule {
  const dayEntries = entries
    .filter((e) => e.day_of_week === dayIndex)
    .sort((a, b) => a.start_minute - b.start_minute || a.duration_minutes - b.duration_minutes);

  const activeChildren = childrenList.filter((c) => c.is_active !== false);
  const activeIds = new Set(activeChildren.map((c) => c.id));
  const columns: DayColumn[] = activeChildren.map((c) => ({ id: c.id, child: c }));

  const columnIdsFor = (e: RoutineEntryData): string[] => {
    const ids = e.child_ids.filter((id) => activeIds.has(id));
    if (ids.length > 0) return ids;
    // Entries for nobody — or only for archived children — go to the family column
    return e.child_ids.length === 0 ? [FAMILY_COLUMN_ID] : [];
  };

  const rowsByStart = new Map<number, DayRow>();
  let needsFamilyColumn = false;
  for (const entry of dayEntries) {
    const ids = columnIdsFor(entry);
    if (ids.length === 0) continue;
    if (ids[0] === FAMILY_COLUMN_ID) needsFamilyColumn = true;
    let row = rowsByStart.get(entry.start_minute);
    if (!row) {
      row = { startMinute: entry.start_minute, cells: {} };
      rowsByStart.set(entry.start_minute, row);
    }
    for (const id of ids) {
      (row.cells[id] ??= []).push(entry);
    }
  }

  if (needsFamilyColumn) columns.push({ id: FAMILY_COLUMN_ID, child: null });

  const rows = Array.from(rowsByStart.values()).sort((a, b) => a.startMinute - b.startMinute);
  return { columns, rows };
}
