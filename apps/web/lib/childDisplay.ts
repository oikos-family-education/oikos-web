// Shared helpers for rendering a child's display name and chip initials.
//
// Rule (issue #23): the display name and chip initials must be derived from
// the child's nickname when one is set, otherwise from first_name. Do not
// fall back to the persisted avatar_initials field — that value is not
// guaranteed to track later nickname edits.
//
// Use these helpers everywhere chips/avatars/inline names are rendered to
// keep child labelling consistent across the app.

export interface ChildDisplayInput {
  first_name: string;
  nickname?: string | null;
}

export function getChildDisplayName(child: ChildDisplayInput | null | undefined): string {
  if (!child) return '';
  const nick = (child.nickname ?? '').trim();
  if (nick) return nick;
  return child.first_name ?? '';
}

export function getChildInitials(child: ChildDisplayInput | null | undefined): string {
  const name = getChildDisplayName(child).trim();
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}
