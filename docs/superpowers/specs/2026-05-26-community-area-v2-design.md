# Community Area v2 — Product Spec

**Status:** Draft
**Date:** 2026-05-26
**Builds on:** [Community Area v1](2026-05-26-community-area-design.md) (must ship first; PR [#29](https://github.com/oikos-family-education/oikos-web/pull/29))

## 1. Purpose

v1 gave families a way to discover each other and to form communities with a basic threaded forum. v2 makes those communities feel alive: a richer forum editor with deep-linkable messages, recurring meetups, an in-app notification surface so families know when something happens, a distinct visual identity per community, and pending-request affordances so admins don't miss new members.

## 2. Goals

- Make posting and replying feel pleasant: a formatting toolbar over the existing markdown, and a copy-link affordance for every message.
- Let communities coordinate real-world and online meetups with RSVPs.
- Give every family a reliable in-app cue when something happens in a community they're in.
- Let each community look distinct via a two-tone banner with a chosen emblem.
- Stop admins from missing pending join requests with a sidebar badge they can act on.
- Surface community activity on the dashboard so families see new messages without navigating to each community.

## 3. Non-goals

- **No WYSIWYG editor.** The toolbar inserts markdown over the existing `MarkdownLite` renderer. No HTML editing, no contenteditable.
- **No image uploads in the forum** (no inline images, no attachments). The cover-image upload pipeline is still deferred.
- **No real-time push** (no websockets, no service workers). Notifications are poll-based and shown in-app only — no email or browser push in v2.
- **No external calendar export** (ICS, Google Calendar sync). v2 keeps meetups inside Oikos.
- **No location intelligence** — venue addresses are free-text, no maps, no geocoding.
- **No notification preferences UI beyond per-community mute.** No per-event-type toggles in v2.

## 4. Forum improvements

### 4.1 Formatting toolbar

A toolbar sits above the topic/reply body textarea on:
- New topic form (`/community/[slug]/forum/new`)
- Reply form on the topic detail page
- (Future) any other markdown-lite surface that exists

Buttons (left to right, with keyboard shortcut in parens where standard):
- **Bold** (Cmd/Ctrl+B) — wraps selection in `**...**`
- **Italic** (Cmd/Ctrl+I) — wraps in `*...*`
- **Link** (Cmd/Ctrl+K) — opens a small inline popover asking for URL; wraps the selected text as `[selection](url)`. If nothing's selected, inserts `[text](url)` with the cursor on `text`.
- **Inline code** — wraps in backticks
- **Unordered list** — prefixes each selected line with `- `
- **Ordered list** — prefixes each selected line with `1. `, `2. `, etc.
- **Quote** — prefixes each selected line with `> `
- **Code block** — wraps in triple-backtick fences

All operations are pure string transforms on the textarea's value — no rich-text editor. The textarea keeps its existing behaviour; the toolbar is sugar.

Components:
- `apps/web/components/community/MarkdownToolbar.tsx` — reusable across topic and reply forms.
- Storage model unchanged. Backend unchanged. `MarkdownLite` renderer unchanged.

### 4.2 Message permalinks

Each topic and reply gets a stable link affordance.

- **Topic permalink**: already the URL — `/community/[slug]/forum/[topicId]`.
- **Reply permalink**: `/community/[slug]/forum/[topicId]#reply-[replyId]`. The topic detail page renders each reply with `id="reply-<uuid>"` and applies a brief highlight (`bg-amber-50`, 2-second fade) on mount when the URL has a matching hash.
- A small **chain-link icon** appears in the footer of every topic and reply. Clicking it copies the absolute URL to the clipboard and shows a transient "Link copied" toast.

No backend changes — the `id` field already exists on both `community_topics` and `community_replies`.

## 5. Meetups & calendar

A new sub-tab inside every community: **Meetups**, placed between Forum and Settings in the existing `CommunityTabs`.

### 5.1 Meetup model

A meetup represents either a single occurrence or a recurring series. It belongs to one community. Any active member may create one (no admin gate), but only the creator (or community admin/co-admin) can edit or cancel.

Fields:
- `title` (3–120 chars, required)
- `description` (markdown-lite, max 4,000 chars, optional)
- `starts_at` (UTC, required)
- `duration_minutes` (1–1440, required, defaults to 60)
- `recurrence` enum: `none` | `weekly` | `biweekly` | `monthly` — for v2 only those four
- `recurrence_until` (date, nullable) — when the series ends; null means "indefinitely"
- `location_text` (free text, max 200 chars, optional)
- `meeting_url` (URL, optional) — `http://`, `https://` only
- `created_by_family_id`
- `cancelled_at` (nullable)

Constraint: at least one of `location_text` or `meeting_url` must be present.

### 5.2 RSVPs

Each family in the community may RSVP to a specific occurrence (a specific date in the recurrence). RSVP values: `going` | `maybe` | `not_going`. RSVPs are per-occurrence, not per-series.

For the data model, RSVPs reference `(meetup_id, occurrence_date, family_id)` so weekly meetups can have different attendees each week.

### 5.3 Meetups tab UX

- **Upcoming list** (default): next 8 weeks of occurrences across all the community's meetups, sorted ascending by start. Cancelled meetups are hidden from this view.
- **Past** toggle: hides upcoming, shows the last 8 weeks.
- Each row shows: title, date+time (in the viewer's timezone), location/online badge, RSVP count (e.g. "5 going, 2 maybe"), and a one-click RSVP control for the viewer's family.
- Click a row → meetup detail page (`/community/[slug]/meetups/[meetupId]`) with description, full RSVP list (family names + shields), and edit/cancel actions for owner/admin.
- "New meetup" button (members only) opens a creation modal.

### 5.4 Recurrence handling

Recurrence is computed on read — no row-per-occurrence storage. The server expands a meetup's series into occurrences within a query window (default: next/previous 8 weeks). Skipping a single occurrence is **not** in scope for v2 — you cancel the whole series.

## 6. Notifications

### 6.1 What triggers a notification

Every active member of a community receives a notification when **either** of the following happens in a community they belong to:

1. A new **topic** is created in the community's forum.
2. A new **reply** is added to any topic in the community.

Exclusions:
- The actor never gets their own notification (no "you replied to your own post").
- Replies to deleted topics don't notify.
- Per-community mute (§6.4) suppresses both event types together.

Out of v2: meetup creation, RSVP changes, member join/leave, admin promotions. These do not notify.

### 6.2 Notification model

One row per recipient per event. Fields:
- `id`
- `recipient_family_id` (the family that should see this notification)
- `community_id`
- `event_type` enum: `topic_created` | `reply_created`
- `topic_id` (always set; the topic the event relates to)
- `reply_id` (set only for `reply_created`)
- `actor_family_id` (the family that did the thing)
- `read_at` (nullable)
- `created_at`

Index on `(recipient_family_id, read_at, created_at DESC)` to back the "unread first" sort.

Notifications are recipient-scoped, not subscription-scoped — a family in 4 communities posting a topic creates `N - 1` rows where N is the active member count of that community.

### 6.3 Notification surface

A **bell icon** lives in the `TopBar`, visible on every authenticated page. It shows:
- An unread badge (count up to 9, then "9+") in red.
- A click opens a dropdown panel (max-h ~70vh, scrollable) with the 25 most recent notifications, unread first.
- Each item: actor family name + shield (mini), what happened ("posted in <community>", "replied in <topic>"), relative timestamp, and a link to the topic (or to the reply via the §4.2 permalink anchor).
- "Mark all as read" link at the bottom.
- Empty state: "You're all caught up."

Polling: the bell polls `GET /api/v1/notifications?unread=true&limit=1` every 60s to check for new unread items. Opening the dropdown fetches the full list once. No websockets.

When a user clicks a notification, it's marked read server-side (single-row PATCH), then the router navigates to the target URL.

### 6.4 Per-community mute

On a community's overview page, members can toggle **"Mute notifications"**. State stored as `CommunityMember.notifications_muted` boolean (new column, default `false`). When `true`, the notification fan-out skips that recipient for that community. Mute is purely a recipient-side filter — other families' notifications are unaffected.

## 7. Community identity — two-tone banner + emblem

Each community gets a configurable visual identity, rendered as a banner at the top of every community page.

### 7.1 Banner model

Stored as JSONB on `Community`:

```
identity: {
  primary_color: "#1B2A4A",     // background gradient start
  secondary_color: "#C5A84B",   // background gradient end
  emblem: "compass",            // identifier from the curated emblem set
  emblem_color: "#FFFFFF",      // emblem foreground
  layout: "left" | "center"     // emblem placement, defaults to "left"
}
```

All fields optional; defaults applied at render time. The two existing fields `tagline` and `member_count` continue to render inside the banner.

### 7.2 Emblem set

A curated set of **at least 80** `lucide-react` icons grouped into themes the admin can browse. Stored as a string identifier matching the lucide component name. Initial grouping (final list to be vetted against lucide's actual exports during implementation):

- **Nature** (15): `Leaf`, `Flower`, `Sprout`, `TreePine`, `Trees`, `Sun`, `Moon`, `Star`, `Cloud`, `Mountain`, `Waves`, `Wind`, `Snowflake`, `Wheat`, `Flame`
- **Weather & sky** (4): `Sunrise`, `Sunset`, `Rainbow`, `CloudRain`
- **Faith** (8): `Cross`, `Anchor`, `Heart`, `Feather`, `Crown`, `Church`, `Sparkles`, `Lamp`
- **Education** (12): `BookOpen`, `Book`, `GraduationCap`, `Scroll`, `Pen`, `Brain`, `Lightbulb`, `Microscope`, `Telescope`, `Globe`, `Compass`, `Map`
- **Family & home** (8): `Home`, `Users`, `Baby`, `Tent`, `Castle`, `Building`, `Key`, `Shield`
- **Animals** (10): `Bird`, `Fish`, `Owl`, `Cat`, `Dog`, `Rabbit`, `Squirrel`, `Turtle`, `Snail`, `Bug`
- **Tools & symbols** (10): `Hammer`, `Wrench`, `Paintbrush`, `Palette`, `Music`, `Mic`, `Camera`, `Rocket`, `Award`, `Trophy`
- **Food & hearth** (7): `Coffee`, `Apple`, `Cherry`, `Carrot`, `Cake`, `ChefHat`, `Soup`
- **Music & arts** (5): `Drum`, `Guitar`, `Piano`, `Theater`, `Film`
- **Sports & games** (5): `Bike`, `Dumbbell`, `Gamepad2`, `Puzzle`, `Dice5`

That's ~84 candidates across 10 themes. Final curated list lives in `apps/web/lib/communityEmblems.ts`:
```ts
export interface Emblem { id: string; group: string; }
export const EMBLEMS: Emblem[] = [ ... ];
```

The admin form renders a tabbed picker grouped by theme, with the icon and its label.

### 7.3 Where the banner renders

- **Community Overview** (`/community/[slug]`): full banner at the top, 100% width × ~140px tall. Gradient background, emblem (h-16) on left or centre per `layout`, name + tagline + chips in white text on top.
- **CommunityCard** (used in /community index and on family profile pages): a compact 8px-tall strip across the top in the gradient colours, plus the emblem rendered at h-6 next to the name. Lightweight identity cue.
- **CommunityTabs** sub-nav: the active tab underline uses the primary colour instead of `text-primary`.

Fallback when `identity` is null: a neutral indigo→slate gradient with no emblem.

### 7.4 Editing the identity

A new section in `/community/[slug]/settings` called "Identity":
- Two color pickers (`<input type="color">`) for primary and secondary.
- Emblem picker (modal with the tabbed grid from §7.2).
- Emblem color picker.
- Layout toggle.
- Live preview of the banner at the top of the section that updates as the admin changes fields.

Admin + co-admin only.

## 8. Sidebar pending-request badges

The `Communities` sidebar entry gains a small red-dot badge with a count when the viewer's family is an `admin` or `co_admin` in any community with pending join requests.

- Total count is `SUM(pending join requests across all communities where you are admin/co_admin)`.
- Fetched via a new lightweight endpoint: `GET /api/v1/communities/admin-pending-count` → `{ count: 5 }`.
- Polled every 60s by a small hook in the `Sidebar` component (same cadence as the notification bell).
- Badge appears as a small `bg-amber-500` dot with the count inside, top-right of the sidebar icon.
- Clicking the sidebar entry just navigates to `/community` as before; the per-community badge on the community card (already present in v1) gives admins the drill-down.

If the count is `0`, no badge renders.

## 9. Dashboard communities widget

A new widget on the family dashboard (`/dashboard`) — placed in the right-rail of the dashboard grid, between `OngoingProjects` and `NeglectedSubjects`, called **Your communities**.

### 9.1 What it shows

- Title: "Your communities" with a small chevron link to `/community`.
- One row per community the family is in with `status='active'`, ordered by **last activity desc** (latest topic or reply across all topics in that community). Pending memberships are not listed here.
- Each row shows:
  - The community's emblem icon (from §7 identity), tinted in the primary color, rendered at h-8.
  - Community name (truncated).
  - A small **unread chip** in red showing the count of unread `notifications` rows for this family scoped to that community. Hidden when zero.
  - The latest forum activity summary on a second line: "<actor family> · <topic title>" truncated to one line. Plain text only — no markdown render.
  - A relative timestamp on the right ("2h ago").
- Clicking the row navigates to the community's forum (`/community/[slug]/forum`).
- Empty state when the family is in zero communities: "You're not in any community yet." with a primary button linking to `/community`.
- Soft cap: render at most 8 rows. If the family is in more (only possible via legacy data — v1 caps at 5), show "+N more" linking to `/community`.

### 9.2 Data shape

Hydrated from a single new endpoint to keep the dashboard fast:

```
GET /api/v1/communities/dashboard-summary
→ [
    {
      community: { id, slug, name, identity, ... },
      unread_count: number,
      last_activity: {
        type: "topic" | "reply",
        topic_id: uuid,
        topic_title: string,
        actor_family_name: string,
        created_at: iso8601
      } | null
    },
    ...
  ]
```

Returns at most 8 rows ordered by `last_activity.created_at DESC`, with ties broken by community name asc. `last_activity` is `null` for communities with no posts; those still appear at the bottom of the list.

The endpoint is cheap by design: one query joining `community_members` × `communities`, one lateral join for last activity per community, and one count per community for unread notifications. All scoped to the caller's family.

### 9.3 Behaviour

- Polled by the widget every 90s (slightly slower than the notification bell to avoid duplicated load).
- Clicking a row navigates to `/community/[slug]/forum` and marks any notifications for that community as read on arrival (existing notification mark-read fires from the topic detail when opened — no extra fan-out needed for the row itself).
- Honours the per-community mute from §6.4: muted communities still appear in the widget (the user still belongs to them) but the unread chip is hidden — mute is about pull notifications, not about hiding the community.

## 10. Data model

All schema changes in one Alembic migration.

### 9.1 New `Community` columns

```
identity   JSONB NULL    -- shape per §7.1
```

The notification mute is a column on the existing `community_members` table:

```
notifications_muted BOOLEAN NOT NULL DEFAULT FALSE
```

### 9.2 New tables

**`community_meetups`**
```
id                  UUID PK
community_id        UUID NOT NULL FK communities.id ON DELETE CASCADE
created_by_family_id UUID NOT NULL FK families.id ON DELETE RESTRICT
title               VARCHAR(120) NOT NULL
description         TEXT NOT NULL DEFAULT ''
starts_at           TIMESTAMPTZ NOT NULL
duration_minutes    INTEGER NOT NULL DEFAULT 60
recurrence          VARCHAR(20) NOT NULL DEFAULT 'none'   -- 'none'|'weekly'|'biweekly'|'monthly'
recurrence_until    DATE NULL
location_text       VARCHAR(200) NULL
meeting_url         VARCHAR(500) NULL
cancelled_at        TIMESTAMPTZ NULL
created_at, updated_at
CHECK (recurrence IN ('none','weekly','biweekly','monthly'))
CHECK (location_text IS NOT NULL OR meeting_url IS NOT NULL)
CHECK (duration_minutes BETWEEN 1 AND 1440)
```

Index: `(community_id, starts_at)`.

**`community_meetup_rsvps`**
```
id                  UUID PK
meetup_id           UUID NOT NULL FK community_meetups.id ON DELETE CASCADE
family_id           UUID NOT NULL FK families.id ON DELETE CASCADE
occurrence_date     DATE NOT NULL
response            VARCHAR(20) NOT NULL   -- 'going'|'maybe'|'not_going'
created_at, updated_at
UNIQUE (meetup_id, family_id, occurrence_date)
CHECK (response IN ('going','maybe','not_going'))
```

**`notifications`**
```
id                  UUID PK
recipient_family_id UUID NOT NULL FK families.id ON DELETE CASCADE
community_id        UUID NULL FK communities.id ON DELETE CASCADE
event_type          VARCHAR(30) NOT NULL
topic_id            UUID NULL FK community_topics.id ON DELETE CASCADE
reply_id            UUID NULL FK community_replies.id ON DELETE CASCADE
actor_family_id     UUID NULL FK families.id ON DELETE SET NULL
read_at             TIMESTAMPTZ NULL
created_at          TIMESTAMPTZ NOT NULL
INDEX (recipient_family_id, read_at, created_at DESC)
```

Notifications are a generic table on purpose: future event types can land here without schema changes.

## 11. API surface

All routes under `/api/v1`, auth via existing `get_current_user` cookie.

### 11.1 Forum (no new endpoints, but two response additions)

Existing topic/reply responses unchanged. The toolbar and permalinks are pure frontend additions.

### 11.2 Community identity

- `PATCH /communities/{slug}` — accepts the new `identity` JSON field. Admin + co-admin only.

No new dedicated endpoints; the v1 update endpoint extends.

### 11.3 Meetups

- `GET /communities/{slug}/meetups?from=<iso>&to=<iso>` — returns expanded occurrences in the window (default: next 8 weeks). Includes the viewer's RSVP for each occurrence and aggregated counts.
- `POST /communities/{slug}/meetups` — member action. Body matches §5.1.
- `GET /communities/{slug}/meetups/{meetup_id}` — meetup detail + paginated RSVPs for the next/recent occurrence.
- `PATCH /communities/{slug}/meetups/{meetup_id}` — owner or admin/co-admin.
- `POST /communities/{slug}/meetups/{meetup_id}/cancel` — owner or admin/co-admin.
- `POST /communities/{slug}/meetups/{meetup_id}/rsvp` — body: `{ occurrence_date, response }`.

### 11.4 Notifications

- `GET /notifications?unread=<bool>&limit=<n>&before=<iso>` — paginated, recent-first, unread first when sort is default. Default `limit=25`, hard cap 100.
- `GET /notifications/unread-count` — cheap `{ count: n }` endpoint for the bell badge poll.
- `POST /notifications/{id}/read` — marks one notification read.
- `POST /notifications/mark-all-read` — marks every unread for the caller's family as read.

### 11.5 Mute toggle

- `PATCH /communities/{slug}/mute` — body `{ muted: bool }`. Members only.

### 11.6 Admin pending count

- `GET /communities/admin-pending-count` — returns `{ count: n }` summing pending join requests across every community where the caller's family is `admin` or `co_admin` and `status='active'`. Used by the sidebar badge in §8.

### 11.7 Dashboard summary

- `GET /communities/dashboard-summary` — returns the array described in §9.2. Used by the dashboard widget. Scoped to the caller's family. Hard cap of 8 rows.

## 12. Service layer

New service files:
- `apps/api/app/services/meetup_service.py` — create, edit, cancel, RSVP, expand recurrence into occurrences.
- `apps/api/app/services/notification_service.py` — list, read, mark-all-read, **fan-out** (called by `community_service.create_topic` and `create_reply`).

The fan-out helper takes `(community_id, event_type, topic, reply, actor_family_id)` and writes one notification row per active, non-actor, non-muted member of the community. Wrapped in the same DB transaction as the topic/reply create so we never end up with the post but no notifications, or vice versa.

Recurrence expansion is a pure Python helper:
```python
def expand_occurrences(meetup, window_start, window_end) -> list[date]: ...
```
Returns the list of dates within `[window_start, window_end]` that the meetup falls on. Tested with focused unit tests on the edge cases (DST switch, recurrence_until before window, single non-recurring meetup outside window).

## 13. Frontend

### 13.1 New routes

```
apps/web/app/[locale]/(dashboard)/community/[slug]/meetups/page.tsx           -- list
apps/web/app/[locale]/(dashboard)/community/[slug]/meetups/[meetupId]/page.tsx  -- detail
apps/web/app/[locale]/(dashboard)/community/[slug]/meetups/new/page.tsx       -- create
```

Plus a small `Meetups` tab added to `CommunityTabs` between Forum and Settings.

### 13.2 New components

- `MarkdownToolbar` — buttons + link-popover, takes a `textareaRef` and a value getter/setter.
- `CopyLinkButton` — small icon button + toast hook.
- `CommunityBanner` — renders the §7 banner; reused on Overview and Members and Forum pages.
- `EmblemPicker` — modal with grouped tabs, click-to-select.
- `MeetupCard`, `MeetupRsvpControl`, `MeetupForm` — for the meetups tab.
- `NotificationBell` — bell + badge + dropdown. Lives in `TopBar`.
- `NotificationItem` — single row in the bell dropdown.
- `MuteToggle` — small switch on community overview.
- `DashboardCommunities` — the widget described in §9. Lives in `components/dashboard/` next to the other dashboard widgets. Uses the same `WidgetCard` shell as `OngoingProjects` and friends. Reuses `EmblemIcon` from §7's emblem set helper.

### 13.3 i18n

New namespaces:
- `Meetups` — labels, recurrence options, RSVP controls, "Add to calendar" (no-op for v2 but reserved).
- `Notifications` — bell tooltip, empty state, list strings.
- Extensions to existing `Community.identity` and `Community.forum.toolbar.*` namespaces.
- `Dashboard.communitiesWidget` — title, empty state, "+N more" link, unread chip label for screen readers ("{count} unread messages").

### 13.4 Wiring

- `TopBar` gains `NotificationBell`. Single new import. No layout reflow.
- `Sidebar` polls the admin-pending-count endpoint when the viewer has any community membership with admin/co-admin role; badge rendered next to the Communities item.
- `CommunityFilters`, `CommunityCard`, `CommunityTabs` all gain identity colour hints (border, underline, top strip).
- `app/[locale]/(dashboard)/dashboard/page.tsx` mounts `<DashboardCommunities />` in the right-rail between `OngoingProjects` and `NeglectedSubjects`. The widget is render-once-fail-silently — a failed fetch hides the widget rather than blocking the page.

## 14. Privacy & permissions

| Action | admin | co_admin | member | non-member |
|--------|:-----:|:--------:|:------:|:----------:|
| Edit community identity | ✓ | ✓ | ✗ | ✗ |
| Create meetup | ✓ | ✓ | ✓ | ✗ |
| Edit / cancel meetup | ✓¹ | ✓¹ | ✓² | ✗ |
| RSVP | ✓ | ✓ | ✓ | ✗ |
| See meetup list | ✓ | ✓ | ✓ | ✗ |
| Mute community | ✓ | ✓ | ✓ | ✗ |
| Receive notifications | ✓ | ✓ | ✓ | n/a |

¹ Admins can edit/cancel any meetup in the community.
² Members can edit/cancel only the meetups they created.

No new fields are exposed publicly. Notifications are scoped to the recipient family — never visible to anyone else.

## 15. Migration & rollout

- Single Alembic migration adds the three new tables and the `identity` + `notifications_muted` columns.
- No data backfill required — defaults are all benign (`notifications_muted=false`, `identity=NULL` falls back to the neutral gradient).
- The notification fan-out runs at write time for new posts only — historical topics/replies don't generate retroactive notifications.
- Sidebar badge and bell ship behind no feature flag. Closed-beta cohort sees them immediately.

## 16. Testing

**Backend**
- `test_community_v2_identity.py` — round-trip the `identity` JSON, validate emblem id is in the allowlist.
- `test_meetups.py` — create/edit/cancel, recurrence expansion against fixed dates including DST week, RSVP CRUD, the `meeting_url OR location_text` constraint.
- `test_notifications.py` — fan-out skips actor, skips muted recipients, skips inactive members, marks-read endpoint, unread-count endpoint. Plus a test that deleting a topic does not cascade-delete the notification row's `topic_id` reference unexpectedly (it should `SET NULL` via the FK, or leave the notification orphaned but readable — pick one in implementation and test it).

**Frontend**
- Vitest for `MarkdownToolbar` — bold/italic/link/list insertions on a controlled textarea.
- Vitest for `CommunityBanner` — fallback styling when `identity` is null.
- Vitest for `NotificationBell` — empty state, unread count badge, "Mark all read" button.
- Vitest for the per-occurrence RSVP control state machine.
- Vitest for `DashboardCommunities` — empty state, ordering by `last_activity.created_at`, unread chip shown/hidden, muted communities hide the chip but still appear.

**Manual rollout checklist**
- Create a meetup as the admin, RSVP as a second family, see the count update.
- Post a topic and confirm the second family sees a notification within ~60s.
- Mute the community and confirm new posts no longer notify.
- Edit a community's identity and reload — banner reflects the change.
- Post a topic as a second family and confirm the first family's dashboard widget shows the unread chip and the latest-activity line within ~90s.

## 17. Open questions

1. **DST in recurrence**: weekly meetups stored as `starts_at TIMESTAMPTZ` will shift by an hour at DST transitions if the creator's timezone changes. v2 stores in UTC and renders in viewer's tz; we accept the shift. Document in i18n copy.
2. **Notification retention**: how long do read notifications stick around? Default proposal: hard-delete `read=true AND created_at < now() - 30 days` via a scheduled job. Not implemented in v2 unless the table grows fast — add monitoring first.
3. **Mute granularity**: spec ships per-community mute only. If users ask for per-event-type mute (notify on topics but not replies), revisit in v3.
4. **Emblem set vetting**: the final list of 50+ icons needs a pass against lucide-react's actual exports during implementation. Some names in §7.2 may not exist — substitute the nearest available icon.

## 18. Out of scope (v3+)

- Email or browser-push notifications, websockets.
- Meetup ICS export / Google Calendar sync.
- Meetup attendance check-in.
- Per-meetup-occurrence cancellation (only series-level cancel in v2).
- WYSIWYG forum editor.
- Inline images and attachments in forum posts.
- Cover image upload for communities.
- User-level (vs family-level) participation.
- Sub-communities / channels.
