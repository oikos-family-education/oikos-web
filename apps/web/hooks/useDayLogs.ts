'use client';

import { apiFetch } from '../lib/apiFetch';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface TeachingLog {
  id: string;
  taught_on: string;
  child_id: string | null;
  subject_id: string | null;
  minutes: number | null;
  notes: string | null;
}

export interface MarkAllPair {
  childId: string;
  subjectId: string;
  minutes: number;
}

export interface FanoutState {
  done: number;
  total: number;
}

function cellKey(childId: string, subjectId: string): string {
  return `${childId}::${subjectId}`;
}

/**
 * Owns the teaching-log state for a single date.
 *
 * Used by:
 *  - the dashboard TodaySchedule widget (date = today's ISO)
 *  - the /progress LogTab day checklist (date = any selected day)
 *
 * Why a hook: the consumer needs to render a tick per (child × subject) for
 * the day, toggle each one independently, and run a fan-out "Mark all"
 * sweep. Keeping mutation logic out of the rendering component prevents the
 * schedule view from ballooning.
 */
export function useDayLogs(date: string, onChanged?: () => void) {
  const [logs, setLogs] = useState<TeachingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [fanout, setFanout] = useState<FanoutState | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/v1/progress/logs?from=${date}&to=${date}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        setLogs([]);
        return;
      }
      const data = (await res.json()) as TeachingLog[];
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  // When the date changes drop the previous day's busy/fanout state — they
  // refer to a different day's cells and shouldn't bleed across.
  useEffect(() => {
    setBusyKeys(new Set());
    setFanout(null);
    load();
  }, [load]);

  const logByCell = useMemo(() => {
    const m = new Map<string, TeachingLog>();
    for (const log of logs) {
      if (log.child_id && log.subject_id) {
        m.set(cellKey(log.child_id, log.subject_id), log);
      }
    }
    return m;
  }, [logs]);

  const isLogged = useCallback(
    (childId: string, subjectId: string) => logByCell.has(cellKey(childId, subjectId)),
    [logByCell],
  );

  const isBusy = useCallback(
    (childId: string, subjectId: string) => busyKeys.has(cellKey(childId, subjectId)),
    [busyKeys],
  );

  function setBusy(key: string, on: boolean) {
    setBusyKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function postLog(body: Record<string, unknown>): Promise<TeachingLog | null> {
    try {
      const res = await apiFetch('/api/v1/progress/logs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      return (await res.json()) as TeachingLog;
    } catch {
      return null;
    }
  }

  async function deleteLog(id: string): Promise<boolean> {
    try {
      const res = await apiFetch(`/api/v1/progress/logs/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function toggle(childId: string, subjectId: string, minutes: number) {
    const key = cellKey(childId, subjectId);
    if (busyKeys.has(key) || fanout) return;
    setBusy(key, true);
    const existing = logByCell.get(key);
    if (existing) {
      const ok = await deleteLog(existing.id);
      if (ok) {
        setLogs((prev) => prev.filter((l) => l.id !== existing.id));
        onChanged?.();
      }
    } else {
      const created = await postLog({
        taught_on: date,
        child_id: childId,
        subject_id: subjectId,
        minutes,
      });
      if (created) {
        setLogs((prev) => [...prev, created]);
        onChanged?.();
      } else {
        // Likely 409 (already logged from another tab) — sync from server.
        await load();
      }
    }
    setBusy(key, false);
  }

  async function markAll(pairs: MarkAllPair[]) {
    const pending = pairs.filter(
      (p) => !logByCell.has(cellKey(p.childId, p.subjectId)),
    );
    if (pending.length === 0) return;
    setFanout({ done: 0, total: pending.length });
    const created: TeachingLog[] = [];
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      const log = await postLog({
        taught_on: date,
        child_id: p.childId,
        subject_id: p.subjectId,
        minutes: p.minutes,
      });
      if (log) created.push(log);
      setFanout({ done: i + 1, total: pending.length });
    }
    setFanout(null);
    if (created.length > 0) {
      setLogs((prev) => [...prev, ...created]);
      onChanged?.();
    }
    // Resync — picks up any cells that 409'd silently because they were
    // already logged.
    await load();
  }

  return {
    logs,
    loading,
    fanout,
    isLogged,
    isBusy,
    toggle,
    markAll,
    refetch: load,
  };
}
