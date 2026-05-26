# Community Area — Product Spec

**Status:** Draft
**Date:** 2026-05-26
**Depends on:** No prior unshipped specs. Builds on existing `Family`, `User`, and admin moderation models.

## 1. Purpose

Oikos families currently use the platform alone. The Community area lets them find other homeschooling families that share their values and join groups for ongoing conversation and support. It turns Oikos from a private planning tool into a place where families discover each other and build relationships around how they educate.

## 2. Goals

- Let a family discover other families in their country and region, filtered by what actually matters for matching (faith, education method, language).
- Protect children by default: no names, no photos, no precise location ever leaves the family.
- Let families form named communities around shared principles, with clear admin control over who joins.
- Give each community a place to talk — a simple threaded forum.
- Reuse the existing admin moderation pipeline for community content and behaviour.

## 3. Non-goals

- **No map, no GPS, no precise address.** Discovery is country + region only.
- **No private direct messaging between families.** All conversation happens inside a community both families belong to.
- **No real-time chat** in v1. Forum is async, threaded.
- **No meetups, calendar, RSVPs, shared notes, or shared resources** in v1. These are deferred to v2 and are mentioned only in §13.
- **No public global directory.** A family must scope to a country (and usually a region) to browse.
- **No per-member granular permissions inside a community.** Roles are `admin`, `co_admin`, `member` — nothing finer.
- **No multi-language admin UX.** Community feature follows the rest of the web app and uses the existing `en` namespace pattern; other locales added later when the platform adds them.

## 4. Privacy model

The single most important design decision. The platform serves families with children; defaults must protect them.

1. **Discoverable opt-in.** A new `Family.discoverable` boolean (default `false`). A family does not appear in Discover or in any community member list visible to non-members unless `discoverable=true`. Setting it is a deliberate action in onboarding (final step) or in family settings.
2. **Child information.** Discovery profile shows the **number of children** and **age ranges** (e.g. "3 children, ages 5–12"). Never: child names, child photos, child date-of-birth, or any per-child fields.
3. **Location precision.** The maximum precision exposed externally is `country_code` + `region`. The existing `location_city` is **never** exposed in Discover or in community surfaces.
4. **Contact gating.** A family can only see another family's forum posts and member-list entry if they share at least one community. There is no "message this family" button anywhere.
5. **Discoverability boolean is the single gate.** The new `Family.discoverable` boolean (default `false`) is the only field this feature reads when deciding whether a family appears in Discover or in non-member views of communities. The existing `Family.visibility` column (current values include `local`) is **not** touched by this feature in v1 — its repurposing is deferred to v2 when private-by-default DMs or shared-resource sharing are designed.

## 5. Discover

New top-level dashboard route: `/[locale]/discover`.

### 5.1 Layout

Single page with three regions:

- **Filter bar** (top, sticky on scroll): country selector, region selector, and three optional facet filters described below.
- **Result grid** (main): family cards, 3 per row on `lg`, 2 on `sm`, 1 on mobile. Paginated, 24 per page.
- **Empty state**: when no filter is set, shows a short prompt: "Pick a country to start." When filters return zero results, shows a message and a "broaden your filters" button that drops the most restrictive facet.

### 5.2 Required filter: country + region

- Country is **required**. There is no global browse.
- Region is optional but encouraged. When omitted, results show all discoverable families in the country grouped by region (region heading every page break).
- Country and region come from the same vocabulary used in onboarding (`location_country_code`, `location_region`).

### 5.3 Optional filters

- **Faith tradition** (single-select from existing `faith_tradition` vocabulary) and, when a tradition is picked, **denomination** (free-text substring match on `faith_denomination`).
- **Education methods** (multi-select from existing `education_methods` vocabulary). Matches any-of.
- **Home language** (multi-select from existing `home_languages` vocabulary). Matches any-of.

Filters combine with AND across categories, OR within multi-select.

### 5.4 Family card

Each card shows:

- Family name + family coat-of-arms thumbnail (if present)
- Country + region
- Faith tradition + denomination (if set)
- Education purpose (one-line) and up to three education method tags
- Home languages (tag list)
- Children summary: "N children, ages A–B" (omit ages if no children)
- A short excerpt from `family_culture` (first 140 chars, plain text)
- Primary action: **View profile**

### 5.5 Family profile page

Route: `/[locale]/discover/[familySlug]`. Read-only.

Shows everything on the card plus the full `family_culture` text, `worldview_notes`, `current_curriculum` list, `diet`, `screen_policy`, `outdoor_orientation`, and a list of **communities this family is in that you can also see** (i.e. discoverable communities, plus any community you yourself are already a member of). Each listed community links to its overview page.

If you don't share any community with this family, there is no contact action. The page shows a small inline hint: "Join a community together to start a conversation."

## 6. Communities

New top-level dashboard route: `/[locale]/communities`.

### 6.1 Index page

Two sections, stacked:

- **Your communities** — cards for every community the family is a member of (`status='active'`), plus any with `status='pending'` shown with a "request pending" badge. Action: open community.
- **Discover communities** — directory of joinable communities scoped to the same country (region optional, same filter UX as §5.2). Filters: faith tradition, education methods, region scope. Sorted by member count desc, then created_at desc.

Top-right actions: **Create community**, **Join via invite link** (opens a small modal that accepts a token URL).

### 6.2 Membership cap

A family can be an active member of at most **5 communities** (soft cap). The 6th join attempt shows a modal: "You're in 5 communities. Leave one to join another." Pending requests do not count toward the cap. The cap is enforced in `community_service.join_or_request`.

### 6.3 Create community flow

A two-step form, opened from the index page or from the post-onboarding suggestion.

Step 1 — **Identity**:
- Name (3–60 chars, required)
- Slug (auto-derived from name, editable, must be globally unique)
- Cover image (optional, single upload, resized server-side)
- One-line tagline (max 140 chars)
- Description (markdown-lite, max 2,000 chars)

Step 2 — **Principles & scope**:
- Core principles (markdown-lite, max 4,000 chars) — free-text articulation by the creator of what binds the community
- Principle tags (multi-select, drawn from the same vocabularies the family already uses: `faith_tradition`, `education_methods`, `home_languages`) — pre-populated from the creator's family so it's one click to accept
- Region scope: one of `online` (no geography), `country` (single country), `country_region` (country + single region)
- Join mode: one of `request_to_join`, `invite_only`

On submit, the creator's family becomes the sole `admin` (`CommunityMember` with `role='admin'`, `status='active'`).

### 6.4 Community pages

Once inside a community (route `/[locale]/communities/[slug]`), a sub-nav offers:

- **Overview** (default)
- **Members**
- **Forum**
- **Settings** (admins and co-admins only)

#### 6.4.1 Overview

- Cover image (or gradient placeholder)
- Name, tagline, region scope chip, join mode chip
- Description (rendered markdown)
- Core principles (rendered markdown)
- Principle tags
- Admin list (avatars + family names; co-admins included)
- Member count
- "Recently active in the forum" — last 5 topics with author and last-reply timestamp

For non-members viewing a discoverable community, the Overview is the only sub-page accessible. They see a **Request to join** or **Use invite link** action depending on `join_mode`.

#### 6.4.2 Members

- Grid of family cards (same component as §5.4) for `status='active'` members.
- Role badge: `admin` / `co_admin` / `member`.
- Pending requests appear in a separate section, **admins only**, with **Approve** / **Deny** actions.
- Each card's "View profile" links to the family's discovery profile (§5.5).

#### 6.4.3 Forum

- Topic list, paginated 25 per page, sorted by `is_pinned desc, last_reply_at desc`.
- Columns: title (link), author family, reply count, last reply timestamp + author, pinned/locked icons.
- **New topic** button (members only).
- Topic detail page shows the original post and replies in a flat list, oldest first. Reply form at the bottom.
- Bodies use **markdown-lite**: bold, italic, links, lists, code blocks, blockquotes. No raw HTML, no images in v1, no @-mentions.
- Edit window: author may edit their own post or reply within 30 minutes of creation; after that, edits create a small "(edited)" marker but the content remains the author's.
- Delete: author may delete their own post or reply at any time. Deleted content is replaced with a "Deleted by author" placeholder so reply threads still read.

Admin actions on any topic: **Pin**, **Lock** (prevents new replies), **Delete** (replaces with "Removed by community admin" placeholder).
Admin actions on any reply: **Delete** (same placeholder treatment).
Member action on any topic or reply: **Report** — opens a small dialog with `reason` (free-text, 500 chars) and creates a `CommunityReport` row. Reports surface in the existing admin app's moderation queue.

#### 6.4.4 Settings (admins + co-admins)

Two tabs:

- **Edit** — all fields from §6.3 (name and slug editable by `admin` only; everything else by admin and co-admin).
- **People** — list of members with role controls:
  - Admin: can promote a member to `co_admin`, demote a `co_admin`, remove any member, **transfer primary admin** to any active member, **leave community** (with confirm).
  - Co-admin: can remove a `member`, leave community. Cannot promote, demote, or transfer admin.
  - Member appears here only when they themselves are the viewer; otherwise they don't see this tab.

### 6.5 Roles and permissions

| Action                                  | admin | co_admin | member | non-member |
|----------------------------------------|:-----:|:--------:|:------:|:----------:|
| View Overview                          |  ✓   |    ✓     |   ✓    |    ✓¹      |
| View Members                           |  ✓   |    ✓     |   ✓    |    ✗       |
| View Forum                             |  ✓   |    ✓     |   ✓    |    ✗       |
| Post topic / reply                     |  ✓   |    ✓     |   ✓    |    ✗       |
| Edit own post (within 30 min)          |  ✓   |    ✓     |   ✓    |    ✗       |
| Delete own post                        |  ✓   |    ✓     |   ✓    |    ✗       |
| Pin / Lock / Delete others' posts      |  ✓   |    ✓     |   ✗    |    ✗       |
| Approve / Deny join requests           |  ✓   |    ✓     |   ✗    |    ✗       |
| Send invitation                        |  ✓   |    ✓     |   ✗    |    ✗       |
| Remove member                          |  ✓   |    ✓²    |   ✗    |    ✗       |
| Edit community description / principles|  ✓   |    ✓     |   ✗    |    ✗       |
| Edit name / slug                       |  ✓   |    ✗     |   ✗    |    ✗       |
| Promote / demote co-admin              |  ✓   |    ✗     |   ✗    |    ✗       |
| Transfer primary admin                 |  ✓   |    ✗     |   ✗    |    ✗       |
| Delete community                       |  ✓   |    ✗     |   ✗    |    ✗       |

¹ Only if the community is `discoverable` and the non-member is in the same country scope.
² Co-admin can only remove `member`, not other `co_admin`s.

### 6.6 Admin succession

- A community always has exactly **one** family with `role='admin'`. There may be zero or more `co_admin` families.
- If the admin transfers, the previous admin becomes `co_admin` (not `member`) by default; they may then leave or be demoted explicitly.
- If the admin leaves without transferring:
  - If at least one `co_admin` exists, the oldest-joined `co_admin` is auto-promoted to `admin`.
  - Otherwise, the oldest-joined `member` is auto-promoted to `admin`.
  - The promoted family receives a notification: "You're now the admin of <community>."
- If the community has zero members after the leave (last family departing), the community is **soft-deleted** (`deleted_at` set). Forum content is retained for 30 days, then hard-deleted by a scheduled job.

### 6.7 Invitations

- An admin or co-admin can invite a family by:
  - **Family slug or name search** — picks from existing families that have `discoverable=true` OR have been seen in a previous community membership of the inviter's family. Sends an in-app notification + email.
  - **Invite link** — generates a tokenised URL (`/[locale]/communities/join/[token]`). Token: `secrets.token_urlsafe(32)`, hashed with SHA-256, stored in `CommunityInvitation.token_hash`. 14-day expiry. Single-use.
- Invitations bypass the `request_to_join` queue: accepting an invite immediately makes the family a `member` (`status='active'`).
- An invitation does not count against the soft cap until accepted.

### 6.8 Join requests

- For `join_mode='request_to_join'`, the **Request to join** action creates a `CommunityMember` row with `status='pending'`.
- Admins and co-admins see pending requests in the Members tab and as a count badge on the community card.
- Approve flips `status` to `active`, sets `joined_at`. Deny deletes the row.
- A family can have at most one outstanding pending request per community.

## 7. Data model

All new tables live in `apps/api/app/models/community.py` (one file, multiple classes — matches existing convention seen in `family_member.py`). One Alembic migration.

### 7.1 `Family` additions

Two new columns on `families`:

- `discoverable BOOLEAN NOT NULL DEFAULT FALSE`
- `discoverable_set_at TIMESTAMPTZ NULL` — set when discoverable first flips to true; used for analytics, not exposed.

The existing `visibility` column is left untouched in v1 (see §4.5).

### 7.2 `Community`

```
id                  UUID PK
slug                VARCHAR(80) UNIQUE NOT NULL    -- url-safe, lowercase
name                VARCHAR(60) NOT NULL
tagline             VARCHAR(140) NULL
description         TEXT NOT NULL DEFAULT ''       -- markdown-lite
principles_text     TEXT NOT NULL DEFAULT ''       -- markdown-lite
principle_tags      JSONB NOT NULL DEFAULT '{}'    -- {faith: str|null, education_methods: [str], home_languages: [str]}
region_scope        VARCHAR(20) NOT NULL           -- 'online' | 'country' | 'country_region'
country_code        CHAR(2) NULL                   -- required when region_scope != 'online'
region              VARCHAR(100) NULL              -- required when region_scope = 'country_region'
join_mode           VARCHAR(20) NOT NULL           -- 'request_to_join' | 'invite_only'
cover_image_url     VARCHAR(500) NULL
member_count        INTEGER NOT NULL DEFAULT 1    -- denormalised, updated by service
created_by_family_id UUID NOT NULL FK families.id ON DELETE RESTRICT
deleted_at          TIMESTAMPTZ NULL              -- soft-delete
created_at, updated_at
```

Indexes: `country_code`, `region`, `(country_code, region)`, `deleted_at`.
Constraint: `CHECK (region_scope='online' OR country_code IS NOT NULL)`.
Constraint: `CHECK (region_scope!='country_region' OR region IS NOT NULL)`.

### 7.3 `CommunityMember`

```
id              UUID PK
community_id    UUID NOT NULL FK communities.id ON DELETE CASCADE
family_id       UUID NOT NULL FK families.id ON DELETE CASCADE
role            VARCHAR(20) NOT NULL           -- 'admin' | 'co_admin' | 'member'
status          VARCHAR(20) NOT NULL           -- 'pending' | 'active' | 'removed'
joined_at       TIMESTAMPTZ NULL               -- set when status flips to 'active'
removed_at      TIMESTAMPTZ NULL
removed_reason  VARCHAR(500) NULL              -- optional, set when admin removes
created_at, updated_at
```

Constraints:
- `UNIQUE (community_id, family_id)`
- `CHECK (status != 'active' OR joined_at IS NOT NULL)`
- Partial unique index: at most one row per community with `role='admin' AND status='active'`.

### 7.4 `CommunityInvitation`

```
id                  UUID PK
community_id        UUID NOT NULL FK communities.id ON DELETE CASCADE
invited_family_id   UUID NULL FK families.id            -- nullable: link-based invites don't pre-bind a family
invited_by_user_id  UUID NOT NULL FK users.id
token_hash          VARCHAR(64) NOT NULL INDEX
expires_at          TIMESTAMPTZ NOT NULL
accepted_at         TIMESTAMPTZ NULL
accepted_by_family_id UUID NULL FK families.id
revoked_at          TIMESTAMPTZ NULL
created_at, updated_at
```

### 7.5 `CommunityTopic`

```
id              UUID PK
community_id    UUID NOT NULL FK communities.id ON DELETE CASCADE INDEX
author_family_id UUID NOT NULL FK families.id ON DELETE RESTRICT
title           VARCHAR(200) NOT NULL
body            TEXT NOT NULL                  -- markdown-lite
is_pinned       BOOLEAN NOT NULL DEFAULT FALSE
is_locked       BOOLEAN NOT NULL DEFAULT FALSE
deleted_at      TIMESTAMPTZ NULL               -- soft, replaced with placeholder
deleted_by      VARCHAR(20) NULL               -- 'author' | 'community_admin' | 'platform_admin'
reply_count     INTEGER NOT NULL DEFAULT 0
last_reply_at   TIMESTAMPTZ NULL               -- mirrors topic.created_at if no replies
edited_at       TIMESTAMPTZ NULL
created_at, updated_at
```

Index: `(community_id, is_pinned DESC, last_reply_at DESC)` to back the default forum sort.

### 7.6 `CommunityReply`

```
id              UUID PK
topic_id        UUID NOT NULL FK community_topics.id ON DELETE CASCADE INDEX
author_family_id UUID NOT NULL FK families.id ON DELETE RESTRICT
body            TEXT NOT NULL
deleted_at      TIMESTAMPTZ NULL
deleted_by      VARCHAR(20) NULL
edited_at       TIMESTAMPTZ NULL
created_at, updated_at
```

### 7.7 `CommunityReport`

```
id              UUID PK
target_type     VARCHAR(20) NOT NULL           -- 'topic' | 'reply' | 'family'
target_id       UUID NOT NULL                  -- topic id, reply id, or family id
community_id    UUID NULL FK communities.id    -- always set for topic/reply, null for family-level
reporter_family_id UUID NOT NULL FK families.id
reason          VARCHAR(500) NOT NULL
status          VARCHAR(20) NOT NULL DEFAULT 'open'  -- 'open' | 'resolved' | 'dismissed'
resolved_by     VARCHAR(255) NULL              -- admin email
resolved_at     TIMESTAMPTZ NULL
resolution_note VARCHAR(2000) NULL
created_at, updated_at
```

This table is consumed by the admin moderation page; see §10.

## 8. API surface

All routes under `/api/v1`. Auth required on every route via the existing `get_current_user` cookie dependency. Authorisation by community role is enforced in the service layer.

### 8.1 Discover

- `GET /families/discover?country=US&region=NC&faith=christian&methods=charlotte_mason,classical&languages=en,pt&page=1` — returns paginated family cards. Only includes families with `discoverable=true`. Excludes the caller's own family.
- `GET /families/{slug}/profile` — full discovery profile. Returns 404 if the family is not discoverable and you don't share a community.

### 8.2 Communities

- `GET /communities?country=US&region=NC&faith=...&methods=...&page=1` — discover communities (not the ones you're in).
- `GET /communities/mine` — communities the caller's family is in (active + pending).
- `POST /communities` — create. Body matches §6.3.
- `GET /communities/{slug}` — full community detail (overview level for non-members, full for members).
- `PATCH /communities/{slug}` — edit. Admin-only for name/slug; admin + co-admin for other fields.
- `DELETE /communities/{slug}` — soft-delete. Admin-only.

### 8.3 Membership

- `POST /communities/{slug}/join` — for `request_to_join`, creates a `pending` row. Returns 409 if already a member.
- `POST /communities/{slug}/leave` — removes the caller's family. Triggers succession (§6.6) if caller was admin.
- `GET /communities/{slug}/members?status=active|pending` — members list. Admins see pending.
- `POST /communities/{slug}/members/{family_id}/approve` — admin/co-admin.
- `POST /communities/{slug}/members/{family_id}/deny` — admin/co-admin.
- `POST /communities/{slug}/members/{family_id}/remove` — admin/co-admin (with role rules from §6.5).
- `POST /communities/{slug}/members/{family_id}/promote` — admin-only. Promotes to co-admin.
- `POST /communities/{slug}/members/{family_id}/demote` — admin-only. Demotes co-admin to member.
- `POST /communities/{slug}/transfer-admin` — admin-only. Body: `{ to_family_id: UUID }`.

### 8.4 Invitations

- `POST /communities/{slug}/invitations` — admin/co-admin. Body: `{ family_id: UUID | null }`. If `family_id` is null, returns a link-based invite token.
- `GET /communities/{slug}/invitations` — admin/co-admin. Outstanding invitations.
- `DELETE /communities/{slug}/invitations/{id}` — revoke.
- `POST /communities/join/by-token` — accepts `{ token: str }`. Returns the joined community on success.

### 8.5 Forum

- `GET /communities/{slug}/topics?page=1` — list.
- `POST /communities/{slug}/topics` — member action. Body: `{ title, body }`.
- `GET /communities/{slug}/topics/{topic_id}` — topic + paginated replies.
- `PATCH /communities/{slug}/topics/{topic_id}` — author (within 30 min) or admin/co-admin (pin/lock).
- `DELETE /communities/{slug}/topics/{topic_id}` — author or admin/co-admin.
- `POST /communities/{slug}/topics/{topic_id}/replies` — member action.
- `PATCH /communities/.../replies/{reply_id}` — author (within 30 min).
- `DELETE /communities/.../replies/{reply_id}` — author or admin/co-admin.

### 8.6 Reports

- `POST /communities/{slug}/reports` — member action. Body: `{ target_type, target_id, reason }`.
- `GET /admin/community-reports?status=open` — admin app only. Surfaces in existing moderation queue.
- `POST /admin/community-reports/{id}/resolve` — admin app only.

## 9. Service layer

New file `apps/api/app/services/community_service.py`. All cross-table logic lives here.

Key functions:

- `discover_families(db, viewer, country, region, faith, methods, languages, page) -> Page[FamilyCard]`
- `create_community(db, creator_user, payload) -> Community`
- `join_or_request(db, family, community) -> CommunityMember` — enforces 5-cap, dedupes pending, respects join_mode.
- `accept_invitation(db, family, token) -> Community` — enforces 5-cap.
- `transfer_admin(db, community, from_family, to_family)` — atomic role swap.
- `succession_on_leave(db, community, leaving_family)` — implements §6.6.
- `post_topic / post_reply` — increments counters, updates `last_reply_at`.
- `report(db, reporter_family, target_type, target_id, reason)` — writes `CommunityReport`.

Service is the only place that touches `member_count` and `reply_count` denormalisations.

## 10. Admin moderation integration

The existing admin app gains:

- A **Community reports** sub-tab inside the Moderation page, mirroring how the current beta-application queue works.
- Columns: created_at, community, target type, reporter family, reason excerpt, status.
- Detail view: full target content (topic body, reply body, or family card), context (link to community), resolution actions: **Remove content**, **Warn family** (writes to existing moderation log on the user), **Dismiss**.
- Removing content sets `deleted_at` + `deleted_by='platform_admin'` on the topic/reply.
- All resolution actions are written to the existing admin `audit_log`.

No new admin auth or routing — slots into the existing moderation feature.

## 11. Frontend

### 11.1 Routes

```
apps/web/app/[locale]/(dashboard)/discover/page.tsx
apps/web/app/[locale]/(dashboard)/discover/[familySlug]/page.tsx
apps/web/app/[locale]/(dashboard)/communities/page.tsx
apps/web/app/[locale]/(dashboard)/communities/new/page.tsx
apps/web/app/[locale]/(dashboard)/communities/join/[token]/page.tsx
apps/web/app/[locale]/(dashboard)/communities/[slug]/page.tsx                 -- Overview
apps/web/app/[locale]/(dashboard)/communities/[slug]/members/page.tsx
apps/web/app/[locale]/(dashboard)/communities/[slug]/forum/page.tsx
apps/web/app/[locale]/(dashboard)/communities/[slug]/forum/[topicId]/page.tsx
apps/web/app/[locale]/(dashboard)/communities/[slug]/forum/new/page.tsx
apps/web/app/[locale]/(dashboard)/communities/[slug]/settings/page.tsx
```

All routes must be added to `PROTECTED_PATHS` in `apps/web/middleware.ts`.

### 11.2 Components

New components live under `apps/web/components/community/`:

- `FamilyCard` — used in Discover and in Members. Two variants: `full` (with culture excerpt) and `compact` (members tab).
- `CommunityCard` — used in the communities directory and "Your communities" list.
- `DiscoverFilters` — sticky filter bar.
- `CommunityForm` — create / edit form (re-used for both).
- `MembersList` — pending + active + admin controls.
- `TopicList` — sortable, paginated.
- `TopicDetail` — original post + replies + reply form.
- `MarkdownLite` — renderer constrained to the allowed marks (see §12).
- `ReportDialog` — small modal that posts a `CommunityReport`.
- `InviteDialog` — search-or-link invite UI for admins.

Reuses existing UI primitives (`Card`, `Button`, `Input`, `Badge`) from `@oikos/ui`. No new shared package additions in v1.

### 11.3 i18n

Two new namespaces in `apps/web/messages/en.json`:

- `Discover` — page title, filter labels, empty states, profile page.
- `Community` — everything else (creation form, members tab, forum, settings, role labels, report dialog).

Follows the existing flat-key convention (see `.claude/rules/i18n-guidelines.md`).

### 11.4 Navigation

Two new sidebar entries in `apps/web/components/dashboard/Sidebar.tsx`, between **Dashboard** and **Settings**:

- **Discover** (icon: `Compass` from lucide-react)
- **Communities** (icon: `Users` from lucide-react)

Both are only shown to families with `has_family=true`. No badge in v1.

### 11.5 Onboarding update

The existing onboarding flow gains one final step after family setup:

- **"Make your family discoverable?"** — explains §4 in plain language, with a single toggle and a "Learn more" link to a tooltip. Default OFF. Sets `Family.discoverable=true` if accepted; leaves it `false` if declined. Does not touch `visibility`.

Existing families see this prompt as a one-time inline banner on the Dashboard until they choose.

## 12. Markdown-lite

A constrained subset, rendered server-side to sanitised HTML and client-side via a small wrapper. Allowed:

- Bold (`**text**`), italic (`*text*`)
- Links (`[text](https://...)`) — only `http`, `https`, `mailto` schemes; opens in a new tab with `rel="noopener noreferrer"`
- Inline code (`` `code` ``) and fenced code blocks
- Unordered (`-`) and ordered (`1.`) lists
- Blockquotes (`>`)
- Paragraphs (blank line)

**Disallowed:** raw HTML, images, tables, headings, horizontal rules, footnotes. The parser strips disallowed nodes silently. Library choice: `markdown-it` configured with the minimum plugin set, then passed through `bleach` (Python) or `dompurify` (JS) for sanitisation. The server-side render is canonical; the client mirrors it for live preview only.

## 13. Out of scope, deferred to v2

These are the items the spec explicitly excludes from v1 so the scope stays shippable:

- **Meetups & calendar** — recurring weekly meetups, RSVPs, location coordination, online meeting links.
- **Shared notes & resources** — community wiki, shared curriculum recommendations, file uploads.
- **Direct messaging** between families (in or out of communities).
- **Push notifications and email digests** for community activity. v1 ships with no email or push for forum activity; users check in-app.
- **Real-time chat / channels** as an alternative to threaded topics.
- **Map and geo-search.**
- **Sub-communities or child groups within a community.**
- **Community-level analytics dashboards.**
- **User-level (rather than family-level) participation** — replies are attributed to the family, not to the specific co-parent who typed them. v2 may revisit.
- **Multilingual community content** — community fields are stored verbatim; no translation pipeline.

## 14. Migration and rollout

- Single Alembic migration adds the seven new tables and the two new `families` columns (`discoverable`, `discoverable_set_at`).
- No backfill needed: `discoverable` defaults to `false`, which is the safe default for existing families.
- Feature ships behind no flag. The Discover and Communities sidebar entries appear for all users with a family. Existing families see the discoverability banner described in §11.5 until they choose.
- Closed-beta cohort is the first audience. Admin moderation queue is monitored daily during the first two weeks.

## 15. Testing

- **API**: `apps/api/tests/test_communities.py`, `test_community_forum.py`, `test_community_invitations.py`, `test_discover.py`. Tests run against a real Postgres via the existing `conftest.py`. Cover: create + join + leave + succession, 5-cap enforcement, invite token acceptance, forum CRUD with role checks, report creation, discovery filter combinations, privacy (private families never appear).
- **Frontend**: Vitest + RTL for the form components, the markdown-lite renderer, and the role-permission gates. Visual smoke tests for Discover and Community Overview.
- **Manual checklist** at rollout: create a community, invite a second test family, accept via token, post + reply + report, resolve report from admin app, transfer admin, leave as last admin and verify succession.

## 16. Open questions

1. **Cover-image storage.** This spec assumes object storage for community cover images. The codebase does not yet have an image-upload pipeline. The implementation plan must either reuse a pattern (verify there isn't one already), wire up S3-compatible storage, or defer covers to v2. Default if undecided: defer to v2 and skip the cover-image field.
2. **Notification surface.** v1 ships without email digests. Should pending join requests at least produce a numeric badge on the sidebar? Cheap to add; included by default in this spec but flagged here.
3. **Family slug uniqueness in invitations.** Inviting by name needs a chooser when names collide; the spec assumes the existing `family_name_slug` is sufficient. Verify during implementation.
