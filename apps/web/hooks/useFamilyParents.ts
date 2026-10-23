'use client';

import { apiFetch } from '../lib/apiFetch';
import { useEffect, useMemo, useState } from 'react';

export interface FamilyParent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  has_account: boolean;
  role: 'primary' | 'co_parent';
}

export function getParentDisplayName(parent: FamilyParent): string {
  const name = `${parent.first_name ?? ''} ${parent.last_name ?? ''}`.trim();
  return name || parent.email || '';
}

/**
 * Parents listed in the current family (with or without a login), used to
 * pick and display who teaches a subject. Pending invitations are excluded.
 */
export function useFamilyParents() {
  const [parents, setParents] = useState<FamilyParent[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/v1/families/me/members', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: (FamilyParent & { kind: string })[]) => {
        if (!cancelled) setParents(rows.filter((r) => r.kind === 'member'));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const parentsById = useMemo(
    () => Object.fromEntries(parents.map((p) => [p.id, p])) as Record<string, FamilyParent>,
    [parents],
  );

  return { parents, parentsById };
}
