# SPEC-007 — Children
**Version:** 1.0
**Depends on:** SPEC-001 (auth), SPEC-002 (family registration), SPEC-003 (navigation shell), SPEC-004 (subjects)

---

## 1. Overview

The Children page is the central hub for managing every child registered under a family's account. Parents can add, view, edit, and remove (archive) children from this page. Each child's card links out to the major entities associated with that child — their curriculum (subjects), projects, weekly planner — forming the navigation entry point into per-child detail.

---

## 2. Goals

- Give parents a single place to manage all children in their household
- Surface the most important per-child data at a glance (age, grade, active subjects, next lesson)
- Provide quick-access links from each child to their associated entities
- Support adding children who were not registered during the initial family wizard (SPEC-002)

---

## 3. Out of Scope / Deferred

| Item | Reason |
|---|---|
| Child-to-child comparison or group views | Post-MVP |
| Transferring a child to another family account | Post-MVP |
| Child self-login / child-facing UI | Post-MVP; requires a separate auth layer |
| Per-child notification settings | Deferred to a notifications spec |
| Sharing a child's profile with external users (e.g., tutors) | Community spec |
| Assessment and quiz history | Covered in a future Assessment spec |
| Portfolio builder | Covered in a future Portfolio spec |

---

## 4. Page Structure

The Children page lives at `/children` and is accessible via the left navigation shell (SPEC-003). The page has two primary views:

| View | Route | Description |
|---|---|---|
| Children roster | `/children` | Grid of all children in the family |
| Child detail | `/children/[child_id]` | Full profile + linked entity summary for one child |

---

## 5. Children Roster (`/children`)

### 5.1 Layout

A page header shows **"Children"** with a primary **"Add Child"** button aligned to the right. Below it, children are displayed as a **card grid** (2 columns on large viewports, 1 on tablet).

If the family has no children registered yet, an **empty state** is shown (see §5.4).

### 5.2 Child Card

Each card represents one child and displays:

| Field | Notes |
|---|---|
| **Avatar / initials** | If no photo, render initials in a coloured circle. Colour is deterministic from the child's name. |
| **Full name** | Primary label |
| **Age** | Computed from `birthdate`. Format: "8 years old" |
| **Grade level** | Display grade label (e.g., "Grade 3", "Kindergarten") or age-equivalent label if no grade is set |
| **Active subjects count** | "5 subjects" |
| **Curriculum** | Child's active Curriculum |
| **Learning style badge** | Small tag: Visual / Auditory / Kinesthetic / Reading-Writing |

Each card is fully clickable and navigates to `/children/[child_id]`.

The card has a **context menu** (⋯ icon, top-right corner) with the following actions:
- **Edit** — opens the edit child drawer (§6)
- **Archive** — triggers the archive confirmation modal (§7.2)

### 5.3 Card Ordering

Cards are ordered by `created_at` ascending (the order parents added children) by default. No sort UI is required at this stage.

### 5.4 Empty State

When no children have been added:

- Illustration: a simple, brand-consistent open book with a small house icon
- Heading: "No children yet"
- Body: "Add your first child to start planning their education."
- CTA button: "Add Child" (same action as the page-level button)

---

## 6. Add / Edit Child

Try to use the same component/layout (code reusability) used for Child creation during the Family Onboard. Do the necessary changes to make it reusable in both places.

Adding and editing a child uses the **same component**, opened from:
- "Add Child" button on the roster page
- "Edit" in the child card context menu
- "Edit" button on the child detail page

### 6.2 Actions

- **Save** — creates or updates the child record; the roster or detail page reflects the change immediately (optimistic update).
- **Cancel** — prompts "Discard changes?" only if the form is dirty.

### 6.4 After adding/updating a child

After save, the roster is shown with the new/updated child's card.

---

## 7. Child Detail Page (`/children/[child_id]`)

The child detail page is the per-child hub. It is not a settings screen — it is a **dashboard** for one child, combining profile information with navigable summaries of all linked entities.

### 7.1 Page Header

Displays:
- Child's initials
- Full name (H1)
- Age + grade level (subtitle)
- Learning style badge (if set)
- **"Edit"** button — opens the edition
- **"Archive"** link (destructive, secondary styling) — triggers the archive modal

### 7.2 Profile Summary Section

A read-only summary of the fields

If a field is unset, it is shown in muted text: "Not specified."

An **"Edit profile"** affordance (inline link or pencil icon) opens the edition.

### 7.3 Entity Summary Panels

Below the profile summary, the page renders a set of **summary panels**, one per linked entity. Each panel has:
- A title and icon
- A brief summary of current data
- A **primary CTA** that navigates to the relevant section filtered to this child

The panels are arranged in a single column. Order:

---

#### 7.3.1 Curriculum (only active curriculum)

| Element | Content |
|---|---|
| Panel title | "Curriculum" |
| Empty state | "No subjects assigned yet." |
| CTA | "Manage Curriculum →" → navigates to `/subjects?child=[child_id]` |

---

#### 7.3.3 Projects

| Element | Content |
|---|---|
| Panel title | "Projects" |
| Summary | Lists up to 3 active projects by name + current milestone. Shows total: "2 active, 5 completed." |
| Empty state | "No projects yet." |
| CTA | "View all projects →" → navigates to `/projects?child=[child_id]` |


---

### 7.4 Not Found State

If `/children/[child_id]` is accessed for a child that does not belong to the authenticated family, render a 404-style state: "Child not found" with a back link to `/children`.

---

## 8. Archive & Remove

Oikos does not hard-delete children. Children are **archived** to preserve historical data (lessons, journal entries, projects, progress).

### 8.1 Archive Confirmation Modal

Triggered from the context menu on the roster card or the "Archive" link on the detail page.

Modal content:
- **Title:** "Archive [Child Name]?"
- **Body:** "Archiving [Child Name] will hide them from your active roster. All their lessons, journal entries, and projects will be preserved. You can restore them at any time from Settings."
- **Actions:** "Archive" (destructive primary) | "Cancel"

On confirm:
- Set `child.archived_at = now()` on the record
- Remove the child's card from the active roster immediately
- Show a toast: "[Child Name] has been archived. Undo" (undo available for 10 seconds, reverting the archive)

### 8.2 Archived Children

Archived children are not shown on the roster or in entity filters by default. Restoring an archived child is done via the Family Settings page (out of scope for this spec).

---

## 9. Data Model

Use the same data model already present in the system, if necessary make changes.

---

## 10. Permissions & Access Control

- Only authenticated users belonging to the child's `family_id` may view, edit, or archive a child.
- All API access must verify `family_id` matches the authenticated user's family.
- Archived children (`archived_at IS NOT NULL`) are excluded from all list endpoints by default. A `?include_archived=true` query param (family-admin only) may be supported by Claude Code if needed.

---

## 11. UX Notes

- The children roster and entity summary panels must feel **fast**. Prefer skeleton loading states over spinners.
- The add/edit should preserve form state if the user accidentally closes and reopens it (within the same page session).
- All child names across the UI must be rendered from the canonical `full_name` field — no nickname or display name shortcut is introduced in this spec.
- Avatar initials must gracefully handle edge cases: single-word names (use first two letters), hyphenated names (use first letter of each part up to 2).

---