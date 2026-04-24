export type NoteStatus =
  | 'draft'
  | 'todo'
  | 'in_progress'
  | 'to_remember'
  | 'completed'
  | 'archived'
  | 'history_only';

export type NoteEntityType = 'child' | 'subject' | 'resource' | 'event' | 'project';

export const ALL_STATUSES: NoteStatus[] = [
  'draft',
  'todo',
  'in_progress',
  'to_remember',
  'completed',
  'archived',
  'history_only',
];

export const BOARD_STATUSES: NoteStatus[] = [
  'todo',
  'in_progress',
  'to_remember',
  'completed',
];

export const ALL_ENTITY_TYPES: NoteEntityType[] = [
  'child',
  'subject',
  'resource',
  'event',
  'project',
];

export interface Note {
  id: string;
  family_id: string;
  author_user_id: string | null;
  author_name: string | null;
  title: string | null;
  content: string;
  status: NoteStatus;
  entity_type: NoteEntityType | null;
  entity_id: string | null;
  entity_label: string | null;
  tags: string[];
  is_pinned: boolean;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteListResponse {
  items: Note[];
  total: number;
}

export interface NoteDraft {
  id?: string;
  title: string;
  content: string;
  status: NoteStatus;
  entity_type: NoteEntityType | null;
  entity_id: string | null;
  tags: string[];
  is_pinned: boolean;
  due_date: string | null;
}

export interface EntityOption {
  id: string;
  label: string;
}
