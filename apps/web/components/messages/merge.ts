import type { MessageItemRead } from './types';

/**
 * Append `incoming` messages onto `existing`, deduping by id and sorting
 * chronologically (oldest first).
 *
 * Returns the *same* `existing` reference when nothing changed so React
 * can skip re-renders.
 *
 * Used by both the poll loop and the send-response handler — the dedupe
 * is what lets us run them concurrently without ever double-rendering a
 * message (id is server-assigned and unique, so it's a sound key).
 */
export function mergeMessages(
  existing: MessageItemRead[],
  incoming: MessageItemRead[],
): MessageItemRead[] {
  if (incoming.length === 0) return existing;
  const seen = new Set(existing.map((m) => m.id));
  const additions = incoming.filter((m) => !seen.has(m.id));
  if (additions.length === 0) return existing;
  const merged = [...existing, ...additions];
  merged.sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    return da - db;
  });
  return merged;
}
