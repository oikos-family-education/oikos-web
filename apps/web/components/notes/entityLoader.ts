import type { EntityOption, NoteEntityType } from './types';

interface RawChild {
  id: string;
  first_name: string;
  nickname?: string | null;
}
interface RawSubject {
  id: string;
  name: string;
}
interface RawResource {
  id: string;
  title: string;
}
interface RawProject {
  id: string;
  title: string;
}
interface RawEvent {
  id: string;
  title: string;
}

export async function loadEntityOptions(type: NoteEntityType): Promise<EntityOption[]> {
  switch (type) {
    case 'child': {
      const res = await fetch('/api/v1/families/me/children', { credentials: 'include' });
      if (!res.ok) return [];
      const children: RawChild[] = await res.json();
      return children.map((c) => ({ id: c.id, label: c.nickname || c.first_name }));
    }
    case 'subject': {
      const res = await fetch('/api/v1/subjects?source=mine', { credentials: 'include' });
      if (!res.ok) return [];
      const subjects: RawSubject[] = await res.json();
      return subjects.map((s) => ({ id: s.id, label: s.name }));
    }
    case 'resource': {
      const res = await fetch('/api/v1/resources', { credentials: 'include' });
      if (!res.ok) return [];
      const resources: RawResource[] = await res.json();
      return resources.map((r) => ({ id: r.id, label: r.title }));
    }
    case 'project': {
      const res = await fetch('/api/v1/projects', { credentials: 'include' });
      if (!res.ok) return [];
      const projects: RawProject[] = await res.json();
      return projects.map((p) => ({ id: p.id, label: p.title }));
    }
    case 'event': {
      // Load a wide date range around today (last 90 days + next 180 days)
      const from = new Date();
      from.setDate(from.getDate() - 90);
      const to = new Date();
      to.setDate(to.getDate() + 180);
      const params = new URLSearchParams({
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      });
      const res = await fetch(`/api/v1/calendar/events?${params}`, { credentials: 'include' });
      if (!res.ok) return [];
      const events: RawEvent[] = await res.json();
      return events.map((e) => ({ id: e.id, label: e.title }));
    }
    default:
      return [];
  }
}
