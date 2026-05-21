# Admin Center — Product Spec

**Status:** Draft
**Date:** 2026-05-21
**Depends on:** [Closed Beta Program](2026-05-21-closed-beta-program-design.md) (must ship first; provides the `apps/admin` shell, admin auth, allowlist, and audit-log storage)

## 1. Purpose

The closed-beta spec creates the admin app and a single screen for reviewing beta applications. This spec extends the same app into a full operational tool the Oikos team uses to:

- Understand the state of the platform at a glance.
- Look at any family in detail when supporting them or investigating an issue.
- Moderate accounts (block, ban, remove) when needed.
- Review the history of admin actions.
- Add and remove fellow admins.

## 2. Goals

- Give admins immediate visibility into platform usage: families, users, children, content counts, recent activity.
- Let admins find and inspect any family's data quickly without ad-hoc SQL.
- Provide three clear moderation actions with appropriately strong confirms and full audit coverage.
- Surface the existing audit log (created in the beta spec) in the UI with useful filters.
- Let admins manage the allowlist of other admins from the UI.

## 3. Non-goals

- Editing or modifying family content (curriculum, lessons, projects, notes) on behalf of a family — admins observe, they don't act inside families.
- Time-series analytics beyond a 30-day view; no cohort analysis, retention curves, or funnel reports.
- Per-admin permission levels — every admin can do every action. There is no read-only admin role.
- Communication with users from the admin app (messaging, broadcast emails). Out of scope.
- Multi-language UI. Admin app remains English-only.

## 4. Navigation

The admin app's left sidebar gains these entries (in addition to the **Beta applications** entry from the prior spec):

- **Overview** (new default landing page — replaces Beta applications as the post-login landing)
- **Beta applications** (existing)
- **Families**
- **Moderation**
- **Audit log**
- **Admins**

Each entry routes to a dedicated page under the admin app.

## 5. Overview screen

The new default landing page after admin login. Three vertically stacked sections.

### 5.1 Headline counts (top)

A grid of cards showing live counts pulled from the database:

- Families
- Users
- Children
- Subjects
- Curriculums
- Lessons
- Projects
- Resources
- **Beta applications** sub-card: Pending / Approved / Denied / Total
- **Beta capacity:** "Approved X / 50" with a progress bar

Each card shows the total and the change in the last 7 days (e.g. "+12 this week").

### 5.2 30-day activity trend (middle)

A line chart spanning the last 30 days with three toggleable series:

- New signups per day (user creation events)
- New beta applications per day
- Beta approvals per day

Default: all three visible. Hovering a data point shows the date and counts. No drill-down on the chart itself.

### 5.3 Most active families (bottom)

A table of the top 10 families by recent activity.

- "Recent activity" is computed as the most recent timestamp across: any lesson log, note creation, project update, or resource creation in the family — whichever existing signals make sense for activity. Implementer picks the exact set.
- Columns: Family name, owner email, member count, child count, last active (relative + absolute tooltip).
- Row click → Family detail (Section 6.2).

## 6. Families screen

### 6.1 Family list

- A searchable, filterable table of every family in the system.
- **Search:** family name, owner email, owner first/last name.
- **Filters:**
  - Beta status: All / Beta-approved / Non-beta
  - Account status: All / Active / Has blocked member / Has banned member
- **Columns:** Family name, owner email, member count, child count, created at, last active, status badge (Active / Blocked / Banned — based on the owner's state).
- Default sort: last-active descending.
- Row click → Family detail.

### 6.2 Family detail

A dedicated page for a single family.

- **Header:** family name, created date, status badge, "Beta-approved" badge if applicable with link back to the originating beta application.
- **Members panel:** list of users in the family. For each: name, email, role within the family, last login, account status (Active / Blocked / Banned). Clicking a member opens the member-level moderation panel (see Section 7).
- **Children panel:** names, ages or grade levels, created date.
- **Content panel:** counts of subjects, curriculums, lessons, projects, resources. Each count is a link to a read-only list view scoped to this family.
- **Recent activity panel:** last 20 events across the family (lesson logged, project updated, resource added, note created, member joined, etc.) with timestamps. Read-only.
- **Moderation panel:** quick access to actions against the family's owner or the family as a whole (Section 7).

Family-scoped list views (subjects, curriculums, etc.) are read-only — admins cannot create, edit, or delete content on the family's behalf.

## 7. Moderation screen and actions

### 7.1 Moderation screen

A central page that combines:

- **Active blocks** — list of currently blocked users with reason, block-set-at, expiry (if any), the admin who set it, and an "Unblock" action.
- **Active bans** — list of currently banned users with reason, banned-at, and the admin who set it. Unban is _not_ available from the UI (intentional, see 7.4).
- **Email blacklist** — list of emails blocked from re-registration (populated by bans). Each entry shows the source ban and the timestamp.

### 7.2 Triggering actions

The three moderation actions are available from:

- The members panel of a family detail page (act on a single member).
- The family detail header (act on the family's owner / the whole family).
- The moderation screen (unblock only).

Each action opens a confirm dialog and writes an audit log entry.

### 7.3 Block (temporary)

- **Effect:** Target user can no longer log in. Existing sessions are invalidated. The family's data and the user's account are untouched.
- **Inputs:** Reason (required, free text), optional expiry timestamp (calendar picker).
- **Behavior on login attempt:** the user sees "Your account is blocked. Reason: <reason>. Contact support."
- **Auto-lift:** if an expiry was provided, the block lifts automatically at that time. The user becomes active again without admin involvement.
- **Manual unblock:** any admin can unblock from the moderation screen at any time. Reason for unblock is optional.
- **Audit:** `user.block` and `user.unblock` entries, with the actor, target, reason, expiry, and timestamp.

### 7.4 Ban (permanent)

- **Effect:** Target user can no longer log in, ever. Existing sessions invalidated. The user's email is added to the email blacklist.
- **Inputs:** Reason (required).
- **Confirm:** strong dialog with red destructive styling, requiring the admin to type the user's email to confirm.
- **Family handling:** family data is preserved; other family members are unaffected. If the banned user was the family owner, the family becomes orphaned (no owner) — flagged in the family list, but not deleted. (Transferring ownership is out of scope.)
- **Reversal:** **not available from the UI.** Reversing a ban requires direct DB intervention. The audit log preserves who banned whom.
- **Email blacklist behavior:** when a user with a blacklisted email attempts to register (either through the regular flow or via a beta invite), the API returns an error and the UI shows a generic "We cannot create an account with this email" message. The blacklist check happens at the registration endpoint, regardless of source.
- **Audit:** `user.ban` entry.

### 7.5 Remove (hard delete)

- **Effect:** The target user account is deleted. If the target is the family owner, the entire family record and all dependent records (children, subjects, curriculums, lessons, projects, resources, notes, etc.) are deleted via existing CASCADE relationships.
- **Inputs:** Reason (required).
- **Confirm:** strong dialog with red destructive styling, requiring the admin to type the user's email **and** the family name (if removing a family owner) to confirm. The dialog explicitly lists what will be deleted ("This will permanently delete: 1 family, 3 members, 2 children, 47 lessons, ...").
- **Reversal:** none. The audit log entry preserves the record of the action and a JSON snapshot of the deleted user / family at the time, but the data itself is gone.
- **Email blacklist:** removal does **not** blacklist the email. The same person could re-register fresh. (Use Ban first, then Remove if you want both.)
- **Audit:** `user.remove` entry (with snapshot).

### 7.6 Member vs family owner

The three actions target a **user** (a member). When the target is also the family owner:

- Block / Ban: same as for any member — only that user's login is affected. The family continues to function for the other members. The owner role is unchanged.
- Remove: deletes the family because the owner role is required for a family to exist.

When the target is a non-owner member: actions only affect that user; the family continues normally.

## 8. Audit log screen

This screen surfaces the audit log table that was created in the closed-beta spec, now extended with all the new action types introduced here.

- **View:** chronological list of audit entries, newest first.
- **Filters:**
  - Actor (admin email, dropdown of all admins)
  - Action type (multi-select: all action types listed below)
  - Target (free-text search by email or family name)
  - Date range
- **Entry rendering:** timestamp, actor, action type badge, target, one-line summary. Click expands to show the full reason/note and the JSON snapshot.
- Entries are read-only — no edit, no delete from the UI.

### 8.1 Action types covered in this spec

In addition to the beta-related actions from the closed-beta spec:

- `user.block`, `user.unblock`
- `user.ban`
- `user.remove`
- `admin.add`, `admin.remove` (Section 9)
- `admin.login`, `admin.login_denied` (already recorded; surfaced here)

The implementer is free to add more granular action types as needed.

## 9. Admins screen

Lets admins manage the database-backed allowlist (the env-var bootstrap list is still honored but unchanged from this UI — it's intentionally only manageable through deployment).

### 9.1 List view

- Table of all admins: email, source (Env-var bootstrap / Added via UI), added-by (only for UI-added), added-at, last-login.
- Env-var-bootstrapped admins cannot be removed from the UI; their row has the Remove action disabled with a tooltip "Remove from environment configuration and redeploy."

### 9.2 Add admin

- "Add admin" button opens a dialog.
- **Input:** email (must already correspond to an existing Oikos user account).
- **Validation:** if the email doesn't match an existing user, show "No Oikos user found with this email — they must register first." Do not auto-create user accounts.
- On confirm: the email is added to the DB-backed allowlist. They can log into the admin app immediately.
- **Audit:** `admin.add` entry.

### 9.3 Remove admin

- Each removable row has a Remove action with a confirm dialog.
- **Prevent self-lockout:** an admin can remove themselves, with a strong confirm warning ("You will lose admin access immediately"). However, the system prevents removing the last UI-managed admin if no env-var admins exist. Show "Cannot remove the last admin — add another admin first, or use the environment variable to bootstrap one."
- On confirm: removed from the DB allowlist. Their existing admin session continues to function until it next hits the API (next request fails with 401, redirects them out).
- **Audit:** `admin.remove` entry.

## 10. Data the system needs to track

Conceptual additions on top of what the closed-beta spec already records:

- **User moderation state**: status (`active` / `blocked` / `banned`), reason text, set-by admin, set-at timestamp, optional expiry (for blocks).
- **Email blacklist**: list of banned emails with metadata (source ban ID, added-at).
- **Admin allowlist (DB-backed)**: gains the ability to insert and delete from the UI (already exists as a read-only store from the prior spec).
- **Audit log**: gains new action types as listed in Section 8.1, including snapshots for `user.remove`.
- **Activity timestamps**: this spec does not introduce new event tables. The Overview and Family-detail recent-activity views are derived from existing creation/update timestamps across existing models.

## 11. Edge cases and error handling

- **Blocked user with an active session:** session is invalidated immediately on block. Their next request returns 401.
- **Block expires while user is offline:** they can log in normally next time; no notification.
- **Banned user tries to register again with the same email:** registration fails with a generic error. They might successfully register with a different email — that's expected behavior; bans are email-bound, not identity-bound.
- **Banned user is also a beta-approved applicant:** the approved beta application stays as historical record (it links to the now-banned user). No automatic cleanup.
- **Removed family owner with co-members:** confirmed in 7.6 — Remove always deletes the family if the target is the owner, regardless of other members. Other members lose their family access. Their user accounts remain but `has_family` flips to false.
- **Self-action attempts:** an admin attempting to block / ban / remove their own user account is blocked at the API level with "You cannot perform this action on your own account."
- **Concurrent moderation:** if two admins act on the same user simultaneously, the second action operates on the post-first-action state. Audit log preserves both attempts.
- **Audit log infinite growth:** no retention policy in this spec. The implementer should ensure indexes support the filter queries; long-term retention is a future concern.

## 12. Success criteria

- An admin lands on Overview after login and immediately sees current platform counts, the 30-day trend, and the most active families.
- An admin can search for a family by name or owner email, open it, and read everything that family has created.
- An admin can block a member, see the block reflected on the moderation screen, and unblock them; the affected user's login behavior matches the spec at each step.
- An admin can ban a user, attempt to re-register with that email, and be rejected.
- An admin can remove a family owner, confirm the cascade in the dialog preview, and see the family and all dependent content gone from the system afterward.
- An admin can browse the audit log, filter by another admin, and see exactly what that admin has done.
- An admin can add a colleague to the allowlist from the UI, and that colleague can log in immediately; removing them invalidates their access on the next request.

## 13. Out of scope (deliberately deferred)

- Restoring deleted accounts or families.
- Per-admin permission tiers (e.g. read-only admins, super-admins).
- In-app messaging between admins and users.
- Cohort or retention analytics, custom date ranges, exports.
- Audit-log retention/archival policies.
- Bulk moderation actions (e.g. ban-by-IP, batch operations).
