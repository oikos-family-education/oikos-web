import { describe, it, expect } from 'vitest';
import { mergeMessages } from '../../components/messages/merge';
import type { MessageItemRead } from '../../components/messages/types';

function msg(id: string, isoCreatedAt: string): MessageItemRead {
  return {
    id,
    thread_id: 't1',
    author_family_id: 'fam',
    body: id,
    created_at: isoCreatedAt,
  };
}

describe('mergeMessages', () => {
  it('returns the same reference when incoming is empty', () => {
    const existing = [msg('a', '2026-05-28T10:00:00Z')];
    expect(mergeMessages(existing, [])).toBe(existing);
  });

  it('returns the same reference when every incoming id is already known', () => {
    const existing = [msg('a', '2026-05-28T10:00:00Z')];
    const out = mergeMessages(existing, [msg('a', '2026-05-28T10:00:00Z')]);
    expect(out).toBe(existing);
  });

  it('appends genuinely new messages and keeps chronological order', () => {
    const existing = [
      msg('a', '2026-05-28T10:00:00Z'),
      msg('b', '2026-05-28T10:00:05Z'),
    ];
    const incoming = [msg('c', '2026-05-28T10:00:10Z')];
    const out = mergeMessages(existing, incoming);
    expect(out.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('dedupes when a poll returns a message that the send-handler already appended', () => {
    // Concurrent scenario: send POST returned msg "c" and we appended it;
    // a poll then returns the same row from the server. We must not show it twice.
    const existing = [
      msg('a', '2026-05-28T10:00:00Z'),
      msg('c', '2026-05-28T10:00:10Z'),
    ];
    const incoming = [msg('c', '2026-05-28T10:00:10Z')];
    const out = mergeMessages(existing, incoming);
    expect(out.map((m) => m.id)).toEqual(['a', 'c']);
  });

  it('reorders if an incoming message has an earlier timestamp than something in existing', () => {
    // Defensive: even if the server somehow returns an out-of-order row
    // (or two messages share a server-side timestamp inserted by parallel
    // requests), the merged list stays sorted ascending.
    const existing = [
      msg('a', '2026-05-28T10:00:00Z'),
      msg('c', '2026-05-28T10:00:10Z'),
    ];
    const incoming = [msg('b', '2026-05-28T10:00:05Z')];
    const out = mergeMessages(existing, incoming);
    expect(out.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('handles a batch of incoming messages, some already known', () => {
    const existing = [msg('a', '2026-05-28T10:00:00Z')];
    const incoming = [
      msg('a', '2026-05-28T10:00:00Z'), // dupe
      msg('b', '2026-05-28T10:00:05Z'),
      msg('c', '2026-05-28T10:00:10Z'),
    ];
    const out = mergeMessages(existing, incoming);
    expect(out.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });
});
