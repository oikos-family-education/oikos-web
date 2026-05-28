# Family-to-Family Messages — Product Spec

**Status:** Draft
**Date:** 2026-05-28
**Depends on:** [Community Area v1+v2](2026-05-26-community-area-design.md) — reuses the `Family` model, the family discovery profile, and the in-app `Notification` table introduced for community activity.
**Lifts from §13:** v1 of the Community spec deferred "direct messaging between families" to v2. This spec is that v2 increment.

---

## 1. Purpose

Today two Oikos families can find each other in Discover and end up in the same community, but the only way to talk is to post inside a forum topic that every other community member can read. There is no way for one family to reach out privately — to ask "can our kids do a project together?", "can we swap curriculum notes?", or "we're moving to your region next year". This spec adds a private 1:1 channel between two families, scoped to families (not individual users), with strict abuse controls and reuse of the existing notification surface.

## 2. Goals

- Let one family send a private, threaded conversation to another family they can see in Discover.
- Make the inbox a first-class destination in the sidebar — **Messages** — alongside Discover and Communities.
- Make blocking a single decisive action: a blocked family loses every contact surface with the blocker, both directions.
- Reuse the existing `Notification` fan-out so unread messages contribute to the same unread badge users already see.
- Keep the privacy bar from the community spec intact: no child names, no DOBs, no precise locations are ever exposed through messaging.

## 3. Non-goals

- **No group threads.** A thread has exactly two participating families. Three-family conversations belong in a community forum.
- **No per-user (individual co-parent) threads.** A thread is family→family. Either parent on either side can read and reply; both sides see the same conversation.
- **No attachments in v1.** Text + markdown-lite only (same subset as community forum).
- **No real-time / push.** Same posture as community v1 — async, in-app notifications, no email digests in v1.
- **No edit / delete of sent messages.** A sent message is immutable. Users can delete an entire thread for themselves (see §6.5) but cannot rewrite history.
- **No message requests / inbox-filtering separate from the main list** in v1. We solve abuse via blocking + a soft rate limit instead of a "message requests" purgatory.
- **No read receipts visible to the sender.** The reader's family sees their own unread state; the sender does not see "seen at 14:32". Avoids passive-aggressive UX and matches the calm tone of the rest of the product.
- **No reactions, no @-mentions, no typing indicators.**

## 4. Privacy & abuse model

Messaging is the most dangerous surface in the platform so far — first time one family can address another directly. The defaults are conservative.

1. **Discoverable opt-in is the only gate to *initiate*.** A family can only send a *first* message to another family they can actually see in Discover — i.e. the recipient has `discoverable=true` *and* is in a country/region the sender can browse, *or* the two families share at least one active community. If neither condition holds, the **Send message** button is hidden and the API returns 404 (not 403 — we don't leak that the family exists).
2. **No name/photo leakage for children.** Messaging surfaces only ever show family-level identity: family name + coat-of-arms thumbnail. Never child names, never child ages of a specific child.
3. **One open thread per pair.** There is at most one `MessageThread` row per unordered pair of families. A second "send message" click reopens the existing thread; it does not create a parallel one. This makes "did I already write to them?" a non-question and makes blocking exhaustive.
4. **Block is mutual and total.** When family A blocks family B:
   - Either side's UI hides the other in Discover (the card is filtered out).
   - The shared community member lists still render B's card to A (we don't pretend they left the community), but the card has no **Send message** and no **View profile** action; clicking the family name routes to a small "Unavailable" page. Same in reverse.
   - The existing thread (if any) becomes read-only for *both* sides and is moved into an Archived / Blocked filter in the inbox. Neither side can post into it.
   - Forum posts already authored by B in shared communities remain visible to A (and vice-versa) — we don't rewrite community history. But A's inbox no longer surfaces any future notification that *originates* from B's family in a private channel.
5. **Soft rate limit on first contact.** A family can start at most **5 new threads per 24 hours**. Replies inside existing threads are not capped. Limit is Redis-backed (`messages:newthreads:{family_id}` with 24h TTL), surfaces as HTTP 429 + a friendly inline error.
6. **Hard size limit.** Body 1–4,000 chars (markdown-lite source, before render).
7. **Report a thread.** Any thread participant can file a `MessageReport` (`reason` free-text, ≤500 chars). Reports flow into the same admin moderation queue as community reports (§10 below).
8. **Auto-block on report.** Filing a report blocks the other family by default (with a checkbox in the report dialog, default ON). Reasoning: a user who is alarmed enough to report should not have to do two clicks to stop further contact.

## 5. Inbox (Messages)

New top-level dashboard route: `/[locale]/messages`.

### 5.1 Layout

Two-column desktop layout, single-column on mobile:

- **Left rail — thread list** (`w-80` desktop, full-width on mobile). Each row: other family's coat-of-arms thumbnail (40px), family name, last message excerpt (1 line, ≤80 chars), relative time of last activity, unread dot. Sorted by `last_message_at desc`. Above the list: a small filter row with three chips — **All** (default), **Unread**, **Archived/Blocked**.
- **Right pane — thread view** (`flex-1`). Empty state when no thread is selected: an illustration + "Pick a conversation, or start one from a family's profile in Discover." When a thread is selected: a sticky header with the other family's name + emblem + a **⋯** menu (Block, Report, Delete thread), the message list (oldest at top, newest at bottom, auto-scrolls to bottom on first open), and a composer at the bottom.

The mobile layout collapses to: list page at `/messages`, thread page at `/messages/[threadId]`. Use Next.js parallel routes only if it stays simple; otherwise just two pages.

### 5.2 Message rendering

- Bubble per message, left-aligned for the other family, right-aligned for own family.
- Body rendered through the existing `MarkdownLite` component (community v1, §12 of that spec).
- Show `created_at` as a small caption beneath each bubble (relative for <24h, absolute date+time after).
- Group consecutive messages from the same author within 5 minutes into a single bubble cluster (separator timestamp at the top of the cluster).
- A "Sent" caption appears under the *last* outgoing message until it's confirmed delivered (i.e. POST returned 201). No "Seen" state (see §3).

### 5.3 Composer

- Textarea + a small **Send** button.
- Submits on `Cmd/Ctrl+Enter`. Plain `Enter` inserts a newline.
- Markdown-lite preview is *not* shown live — the user sees their input as plain text and the rendered version appears in the bubble after send. (Matches community forum behaviour.)
- Disabled state with explanatory text when:
  - The thread is blocked: "You blocked this family." / "This family is no longer reachable."
  - The recipient has become non-discoverable AND you do not share any community AND there are no prior messages — i.e. the channel was closed off. (Existing threads from before the close stay open.)

### 5.4 Unread state and badges

- Unread is per-recipient-family, not per-user. The first read from either parent on a side marks the thread read for that side.
- The existing `Notification` row for a message is what `read_at` is set on (§7.3). The inbox derives "this thread has unread messages" from the latest `MessageItem.created_at > MessageThreadParticipant.last_read_at` on the viewer's side.
- The sidebar **Messages** entry shows an unread badge with the count of threads (not messages) where this family has unread.
- The existing dashboard unread counter (community v2) gains a Messages row alongside community rows. The dashboard widget grouping is described in §9.

## 6. Discover-page entry point

On the family discovery profile (`/[locale]/discover/[familySlug]`):

### 6.1 Send-message button

- A **Send message** button appears in the profile header, next to the country/region chip, when:
  - Viewer is in a family (not solo).
  - Viewer's family ≠ target family.
  - Neither side has blocked the other.
  - Target family is discoverable (the profile already enforces this) OR the two families share an active community.
- Otherwise the button is hidden. No tooltip explaining why — we don't want to advertise the existence of a block.

### 6.2 Click behaviour

- **No existing thread:** opens a `NewMessageDialog` (a small modal) with the recipient family name in the header and an empty composer. On submit, POSTs to `POST /api/v1/messages/threads`, then navigates to `/messages/[newThreadId]`.
- **Existing thread:** navigates straight to `/messages/[existingThreadId]` and focuses the composer. No modal.

The same button + behaviour is added to the Community → Members tab when a member family's card is opened (community v1, §6.4.2). Reuse the same `<SendMessageButton family={...}/>` component so the rule is enforced in one place.

### 6.3 Empty-state hint

The "Join a community together to start a conversation" hint that exists today on profiles you don't share a community with is removed when this feature ships — now you *can* message from Discover. Replace with: nothing (the button is the affordance), unless the viewer is solo, in which case keep the existing "Set up your family first" empty state.

## 7. Data model

All new tables live in a new file `apps/api/app/models/message.py`. One Alembic migration adds the four tables + indexes below, plus a `family_blocks` table.

### 7.1 `MessageThread`

```
id                  UUID PK
family_a_id         UUID NOT NULL FK families.id ON DELETE CASCADE
family_b_id         UUID NOT NULL FK families.id ON DELETE CASCADE
started_by_family_id UUID NOT NULL FK families.id ON DELETE SET NULL  -- audit only
last_message_at     TIMESTAMPTZ NULL  -- mirrors latest MessageItem.created_at
last_message_excerpt VARCHAR(120) NULL  -- denormalised, plain text, for the inbox list
last_message_author_family_id UUID NULL FK families.id ON DELETE SET NULL
created_at, updated_at
```

Invariants:
- `family_a_id < family_b_id` (lexicographic UUID order) — enforced by a `CHECK` so the pair is canonical.
- `UNIQUE (family_a_id, family_b_id)` — at most one thread per unordered pair (§4.3).

Indexes:
- `(family_a_id, last_message_at DESC)` and `(family_b_id, last_message_at DESC)` to back the inbox query without `OR`.

### 7.2 `MessageThreadParticipant`

A small per-side row holding read state + per-side mute. Two rows per thread.

```
thread_id           UUID NOT NULL FK message_threads.id ON DELETE CASCADE
family_id           UUID NOT NULL FK families.id ON DELETE CASCADE
last_read_at        TIMESTAMPTZ NULL
notifications_muted BOOLEAN NOT NULL DEFAULT FALSE
deleted_at          TIMESTAMPTZ NULL    -- per-side soft delete (§6.5)
PRIMARY KEY (thread_id, family_id)
```

A per-side soft delete (`deleted_at` set) hides the thread from that side's inbox; new incoming messages clear it again (i.e. an incoming message un-deletes for the recipient). This matches Gmail/iMessage behaviour and lets blocking + delete + new-thread compose cleanly.

### 7.3 `MessageItem`

```
id              UUID PK
thread_id       UUID NOT NULL FK message_threads.id ON DELETE CASCADE INDEX
author_family_id UUID NOT NULL FK families.id ON DELETE RESTRICT
body            TEXT NOT NULL           -- markdown-lite source, 1..4000 chars
created_at      TIMESTAMPTZ NOT NULL
```

No `edited_at`, no `deleted_at` (§3).

Index: `(thread_id, created_at ASC)` to back the chronological message list.

### 7.4 `FamilyBlock`

```
id              UUID PK
blocker_family_id UUID NOT NULL FK families.id ON DELETE CASCADE INDEX
blocked_family_id UUID NOT NULL FK families.id ON DELETE CASCADE INDEX
reason          VARCHAR(500) NULL          -- optional, never shown to the blocked side
created_at      TIMESTAMPTZ NOT NULL
UNIQUE (blocker_family_id, blocked_family_id)
```

A block is one-directional in storage but enforced **mutually** in the service layer — the `is_blocked(a, b)` helper returns true if a row exists in either direction. This lets the unblocker undo their own block (and only their own) without ever needing to ask the other side.

### 7.5 `MessageReport`

```
id              UUID PK
thread_id       UUID NOT NULL FK message_threads.id ON DELETE CASCADE
reporter_family_id UUID NOT NULL FK families.id
reported_family_id UUID NOT NULL FK families.id
reason          VARCHAR(500) NOT NULL
status          VARCHAR(20) NOT NULL DEFAULT 'open'  -- 'open' | 'resolved' | 'dismissed'
resolved_by     VARCHAR(255) NULL
resolved_at     TIMESTAMPTZ NULL
resolution_note VARCHAR(2000) NULL
created_at, updated_at
```

Mirrors `CommunityReport`'s shape so the existing moderation queue can union them (see §10).

### 7.6 `Notification` reuse

The existing `notifications` table (community v2, §6.2 of that spec) gains two new `event_type` values:

- `message_received` — recipient is the receiving family, actor is the sender family, `thread_id` is the new column below.
- `message_thread_started` — same shape, fired once on the first message of a thread to give it a slightly different copy ("X wrote to you for the first time").

The migration adds:

- `thread_id UUID NULL REFERENCES message_threads(id) ON DELETE CASCADE` on `notifications`.
- The existing `community_id`, `topic_id`, `reply_id` columns remain nullable; for message events they are NULL.

Existing indexes remain. `notifications_muted` on `CommunityMember` is unrelated; per-thread mute lives on `MessageThreadParticipant` (§7.2).

## 8. API surface

All routes under `/api/v1`. Auth via the existing `get_current_user` cookie dependency. Authorisation enforced in `message_service`.

### 8.1 Threads

- `GET /messages/threads?filter=all|unread|archived&page=1` — paginated inbox. Excludes per-side-deleted threads unless `filter=archived`. Returns `last_message_excerpt`, other family's identity bundle, unread bool.
- `POST /messages/threads` — start or reopen. Body: `{ recipient_family_id: UUID, body: str }`. Returns the thread (existing or new) and the first/new message. Enforces §4.1 (gate), §4.5 (5/24h rate limit), §4.6 (length), §4.4 (block).
- `GET /messages/threads/{thread_id}` — thread header + paginated message list (default 50 per page, cursor on `created_at`).
- `POST /messages/threads/{thread_id}/messages` — reply. Body: `{ body: str }`. Same length limit, no rate limit (replies are uncapped per §4.5).
- `POST /messages/threads/{thread_id}/read` — marks `last_read_at = now()` for the caller's side. Also marks all matching `Notification.read_at` for `event_type IN ('message_received','message_thread_started')` so the sidebar badge stays consistent. Idempotent.
- `POST /messages/threads/{thread_id}/mute` — body `{ muted: bool }`. Toggles the caller's side mute.
- `DELETE /messages/threads/{thread_id}` — per-side soft delete (sets `deleted_at` on the caller's `MessageThreadParticipant`). The other side is unaffected.

### 8.2 Blocks

- `POST /messages/blocks` — body `{ family_id: UUID, reason?: str }`. Idempotent. Creates a `FamilyBlock` row. Side-effects:
  - Mark any existing thread between the two families as effectively read-only — done at read time, no row change required (the service checks `is_blocked(a, b)` before allowing a post).
- `DELETE /messages/blocks/{family_id}` — unblock. Removes the caller's row only (the other family's block, if any, persists).
- `GET /messages/blocks` — list. Returns family identity bundles for the caller's outgoing blocks. The caller cannot see *incoming* blocks (they're filtered out of Discover already, so the user-facing effect is the same).

### 8.3 Reports

- `POST /messages/threads/{thread_id}/reports` — body `{ reason: str, also_block: bool = true }`. Creates a `MessageReport`. When `also_block=true`, creates the `FamilyBlock` in the same transaction.
- `GET /admin/message-reports?status=open` — admin app only. Surfaces in the moderation queue described in §10.
- `POST /admin/message-reports/{id}/resolve` — admin app only.

### 8.4 Unread

- `GET /messages/unread-count` — returns `{ threads: int }`. Cheap query backed by the recipient-side index on `MessageThread.last_message_at` joined with the participant's `last_read_at`.

## 9. Service layer & integration with existing services

New file `apps/api/app/services/message_service.py`. All cross-table writes go through it.

Key functions:

- `can_initiate(db, sender_family, recipient_family) -> bool` — implements §4.1 gate (discoverable | shared active community | not blocked). Returns false (not raises) so the router can decide between 404 and "button hidden".
- `start_or_get_thread(db, sender_family, recipient_family, body, sender_user) -> (Thread, MessageItem)` — atomic: enforces §4.5 rate limit, creates or fetches the canonical thread, inserts the message, denormalises `last_message_*`, calls `NotificationService.fanout_message(...)`, returns. The whole thing is one transaction.
- `post_reply(db, thread, author_family, body)` — same shape minus the rate-limit check.
- `mark_read(db, thread, family)` — updates the participant row + bulk-updates matching `Notification.read_at`.
- `block(db, blocker, blocked, reason)`, `unblock(db, blocker, blocked)`, `is_blocked(db, family_a_id, family_b_id) -> bool`.
- `report(db, reporter_family, thread, reason, also_block)` — writes `MessageReport`, optionally writes `FamilyBlock`.

Cross-service touchpoints:

- `CommunityService.discover_families` and `discover_communities` already filter by visibility. They gain a `NOT EXISTS` subquery against `FamilyBlock` so blocked pairs disappear from each other's discovery in both directions (§4.4).
- `CommunityService` members-list responses gain a per-card `is_blocked_either_way: bool` flag so the frontend can hide the **Send message** and **View profile** actions without needing a second round-trip.
- `NotificationService` gains `fanout_message(thread, message)` which writes one `Notification` per *non-author* side that has not muted the thread and has not deleted it. (A side that deleted the thread still gets the notification — that's how the thread reappears in their inbox, per §7.2.)

## 10. Admin moderation integration

The existing admin app's **Moderation** page gains a **Messages** sub-tab beside the existing **Community reports** sub-tab.

- Same column layout: created_at, parties (reporter family / reported family), reason excerpt, status.
- Detail view: full thread transcript (read-only), reporter's context, three actions: **Warn family** (writes to existing moderation log), **Force-block** (writes `FamilyBlock` rows in both directions and marks the report resolved), **Dismiss**.
- Both new actions are written to the existing admin `audit_log`.

No new admin auth or routing — slots into existing moderation.

## 11. Frontend

### 11.1 Routes

```
apps/web/app/[locale]/(dashboard)/messages/page.tsx                  -- inbox + empty pane
apps/web/app/[locale]/(dashboard)/messages/[threadId]/page.tsx       -- specific thread
```

Both must be added to `PROTECTED_PATHS` in `apps/web/middleware.ts`.

### 11.2 Components

New components under `apps/web/components/messages/`:

- `MessageInbox` — the left-rail thread list with filter chips.
- `ThreadHeader` — sticky top of the right pane, with the **⋯** menu (Block, Report, Delete thread).
- `MessageList` — paginated, cursor-based, auto-scroll on first open.
- `MessageBubble` — single bubble; uses `MarkdownLite`.
- `Composer` — textarea + Send button + length counter.
- `NewMessageDialog` — opened from Discover/Members "Send message" button.
- `BlockConfirmDialog` — used on profile and inside threads.
- `ReportDialog` — same shape as community ReportDialog; reused or extended.
- `SendMessageButton` — shared by Discover profile and Community members. Owns the gate logic so the rule lives in one place.

Reuses `Card`, `Button`, `Input`, `Badge` from `@oikos/ui`, plus the existing `MarkdownLite` renderer.

### 11.3 i18n

One new namespace in `apps/web/messages/en.json`: **`Messages`** — inbox title, thread header, composer placeholder, empty states, block/report dialog copy, error toasts (rate limit, length, blocked). Flat-key convention per [.claude/rules/i18n-guidelines.md](../../../.claude/rules/i18n-guidelines.md).

### 11.4 Navigation

One new sidebar entry in `apps/web/components/dashboard/Sidebar.tsx`, inside the **Support** group, *above* Discover:

- **Messages** (icon: `MessageCircle` from `lucide-react`), with an unread badge driven by `GET /api/v1/messages/unread-count`.

Only shown when `has_family=true`. Polled on the same 60s interval as the existing communities pending-count badge — or reuse a single polled `GET /api/v1/notifications/unread-summary` if that endpoint already exists, to avoid two intervals doing the same job.

### 11.5 Dashboard widget

The existing community-activity dashboard widget (community v2) gets a new row group for direct messages: "Conversations" — up to 3 most-recent unread threads, each linking to `/messages/[threadId]`. When there are none, the row group is omitted entirely (no empty placeholder — the widget already has community rows).

## 12. Markdown-lite

Same subset as community forum (community v1 §12). No changes. The renderer is reused via the existing `MarkdownLite` component.

## 13. Out of scope, deferred to a later increment

- Attachments (images, files). Requires the image-upload pipeline still being open (community spec §16).
- Email notifications and push.
- Per-user (rather than per-family) read state and per-user mute.
- Group threads (>2 families).
- Search across messages.
- Export of conversation history.
- Anti-spam beyond the per-day new-thread cap (ML-based filtering, link blocking, etc.).
- "Vacation" / auto-reply.

## 14. Migration and rollout

- Single Alembic migration adds: `message_threads`, `message_thread_participants`, `messages` (or `message_items`), `family_blocks`, `message_reports`, and the `thread_id` column on `notifications`.
- No backfill needed.
- No feature flag: ships to all families with `has_family=true`. The **Messages** sidebar entry and the **Send message** button on Discover profiles appear simultaneously.
- Closed-beta cohort is the first audience. Admin queue monitored daily for the first two weeks, same posture as community v1.

## 15. Testing

- **API**: new `apps/api/tests/test_messages.py` and `apps/api/tests/test_message_blocks.py`. Run against the real Postgres via the existing `conftest.py`. Cover:
  - Canonical-pair invariant (`family_a_id < family_b_id`) — start a thread from either direction, only one row exists.
  - 5/24h new-thread rate limit and that replies are uncapped.
  - Block both directions: discover filter, button gating, post rejection on a now-blocked existing thread.
  - Mutual auto-block on report.
  - Notification fan-out: one row per recipient side, no row for the author side, no row when the side has muted.
  - `mark_read` clears the corresponding `Notification.read_at` rows.
- **Frontend**: Vitest + RTL for `Composer` (length, Cmd+Enter, disabled states), `MessageBubble` (markdown-lite), `SendMessageButton` (gate logic given various viewer/recipient states), `BlockConfirmDialog`, `ReportDialog`.
- **Manual checklist** at rollout: send a first message from Discover; see the notification badge bump on the other account; reply; mute; block; verify the blocked side loses the button on profile and in the shared community member list; file a report from the admin app and resolve it.

## 16. Open questions

1. **Per-user read state.** This spec treats read as per-family (either parent reading marks it read for the household). The community-area v2 notifications already work this way, so we stay consistent. Flagged here because a co-parent might be surprised that the other parent "stole" the unread state. Default: ship per-family, revisit if support tickets show up.
2. **Should an in-progress thread between A and B survive A becoming non-discoverable?** Yes — the gate in §4.1 only applies to *initiating* contact, not to existing threads. The composer stays enabled as long as the thread exists and neither side has blocked. Documented here so reviewers can challenge it.
3. **Markdown-lite link preview.** Out of scope in this spec; carries the same posture as community forum (no link unfurling in v1).
4. **Cross-family notifications endpoint consolidation.** The sidebar currently polls `/api/v1/communities/admin-pending-count`. Adding `/api/v1/messages/unread-count` makes two polls. Consider consolidating into a single `/api/v1/notifications/unread-summary` (returns `{ messages, community_admin_pending, community_activity }`) before shipping, to keep the sidebar from doing N requests per minute.
