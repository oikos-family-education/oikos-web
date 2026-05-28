// Shared types for family-to-family messaging.
// Spec: docs/superpowers/specs/2026-05-28-family-messages-design.md

export interface OtherFamilyIdentity {
  id: string;
  family_name: string;
  family_name_slug?: string | null;
  shield_config?: Record<string, string> | null;
}

export interface MessageItemRead {
  id: string;
  thread_id: string;
  author_family_id: string;
  body: string;
  created_at: string;
}

export interface ThreadInboxRow {
  id: string;
  other_family: OtherFamilyIdentity;
  last_message_excerpt?: string | null;
  last_message_at?: string | null;
  last_message_author_family_id?: string | null;
  unread: boolean;
  is_blocked: boolean;
  notifications_muted: boolean;
  deleted_on_my_side: boolean;
}

export interface ThreadDetail {
  id: string;
  other_family: OtherFamilyIdentity;
  can_send: boolean;
  blocked_by_me: boolean;
  blocked_by_them: boolean;
  notifications_muted: boolean;
  last_read_at?: string | null;
  messages: MessageItemRead[];
  next_cursor?: string | null;
}

export interface InboxPage {
  items: ThreadInboxRow[];
  page: number;
  total: number;
  total_pages: number;
}

export interface StartThreadResponse {
  thread: ThreadDetail;
  message: MessageItemRead;
}

export type InboxFilter = 'all' | 'unread' | 'archived';
