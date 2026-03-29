# SPEC-006 — Projects

**Platform:** Oikos — Open Source Family Education Platform
**Version:** 1.0
**Status:** Ready for implementation

---

## 1. Overview

A **Project** is a structured, multi-milestone assignment that allows a child to apply and demonstrate knowledge gained through one or two Subjects. Projects give families a way to move beyond individual lessons into deeper, integrative learning experiences — a history essay, a science fair entry, a recitation, a nature journal.

Projects are parent-managed. A parent creates a project, links it to 1–2 Subjects, assigns it to one or more children, defines milestones, and logs progress over time. When a project is completed, it can be published as a **Portfolio Entry** for that child.

---

## 2. Core Concepts

| Concept | Description |
|---|---|
| **Project** | The top-level assignment. Has a title, description, subject links, child assignments, date range, and status. |
| **Milestone** | A discrete phase or step within a project. Ordered. Has its own status. |
| **Work Entry** | A parent-logged note attached to a project (optionally to a specific milestone). Records progress, observations, or reflections. |
| **Attachment** | A file (photo, scan, document) associated with a project, milestone, or work entry. |
| **Portfolio Entry** | A child-specific published record created from a completed project. |

---

## 3. Data Model

### 3.1 `projects`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `family_id` | UUID | FK → `families`, NOT NULL | Scopes the project to a family |
| `title` | VARCHAR(255) | NOT NULL | |
| `description` | TEXT | NULLABLE | |
| `status` | ENUM | NOT NULL, default `draft` | See §3.1.1 |
| `start_date` | DATE | NULLABLE | |
| `end_date` | DATE | NULLABLE | |
| `created_by` | UUID | FK → `users`, NOT NULL | Parent who created the project |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### 3.1.1 `project_status` enum

```
draft | active | completed | archived
```

- `draft` — project is being set up; not yet visible in planning views
- `active` — project is underway
- `completed` — all milestones done, or manually marked complete by parent
- `archived` — project is hidden from default views but retained in the database

### 3.2 `project_subjects`

Junction table linking a project to 1–2 Subjects.

| Column | Type | Constraints |
|---|---|---|
| `project_id` | UUID | FK → `projects`, NOT NULL |
| `subject_id` | UUID | FK → `subjects`, NOT NULL |

**Constraint:** A project may have a maximum of 2 rows in this table (enforced at the application layer and via a CHECK-like trigger or application-level validation).

### 3.3 `project_children`

Junction table assigning a project to one or more children.

| Column | Type | Constraints |
|---|---|---|
| `project_id` | UUID | FK → `projects`, NOT NULL |
| `child_id` | UUID | FK → `children`, NOT NULL |
| `assigned_at` | TIMESTAMPTZ | NOT NULL |

### 3.4 `project_milestones`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `project_id` | UUID | FK → `projects`, NOT NULL | |
| `title` | VARCHAR(255) | NOT NULL | |
| `description` | TEXT | NULLABLE | |
| `phase` | ENUM | NOT NULL | See §3.4.1 |
| `position` | INTEGER | NOT NULL | 1-based ordering within a project |
| `due_date` | DATE | NULLABLE | |
| `status` | ENUM | NOT NULL, default `pending` | See §3.4.2 |
| `completed_at` | TIMESTAMPTZ | NULLABLE | Set when status → `completed` |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### 3.4.1 `milestone_phase` enum

```
research | create | present | reflect | custom
```

The platform scaffolds new projects with four default milestones mapped 1:1 to the first four phase values. Parents may rename titles, reorder, add milestones, or change any milestone's phase to `custom`.

#### 3.4.2 `milestone_status` enum

```
pending | in_progress | completed | skipped
```

### 3.5 `project_work_entries`

Parent-authored log entries attached to a project.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `project_id` | UUID | FK → `projects`, NOT NULL | |
| `milestone_id` | UUID | FK → `project_milestones`, NULLABLE | If null, entry is project-level |
| `child_id` | UUID | FK → `children`, NULLABLE | If null, applies to all assigned children |
| `note` | TEXT | NOT NULL | |
| `created_by` | UUID | FK → `users`, NOT NULL | Always a parent |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

### 3.6 `project_attachments`

Files associated with a project, milestone, or work entry.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `project_id` | UUID | FK → `projects`, NOT NULL | Denormalized for query convenience |
| `milestone_id` | UUID | FK → `project_milestones`, NULLABLE | |
| `work_entry_id` | UUID | FK → `project_work_entries`, NULLABLE | |
| `label` | VARCHAR(255) | NULLABLE | |
| `file_url` | TEXT | NOT NULL | S3-compatible storage URL |
| `file_type` | VARCHAR(100) | NOT NULL | MIME type |
| `file_size_bytes` | INTEGER | NULLABLE | |
| `uploaded_by` | UUID | FK → `users`, NOT NULL | |
| `uploaded_at` | TIMESTAMPTZ | NOT NULL | |

At least one of `milestone_id` or `work_entry_id` must be set, OR neither (attachment belongs directly to the project).

### 3.7 `portfolio_entries`

One entry is created **per child** when a project is published to the portfolio.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `project_id` | UUID | FK → `projects`, NOT NULL | |
| `child_id` | UUID | FK → `children`, NOT NULL | One row per child |
| `family_id` | UUID | FK → `families`, NOT NULL | Denormalized for query convenience |
| `title` | VARCHAR(255) | NOT NULL | Pre-filled from project title, editable |
| `summary` | TEXT | NULLABLE | Parent-written reflection on the child's work |
| `cover_attachment_id` | UUID | FK → `project_attachments`, NULLABLE | Featured image for the portfolio entry |
| `published_at` | TIMESTAMPTZ | NULLABLE | NULL = unpublished draft |
| `is_visible_to_family` | BOOLEAN | NOT NULL, default `true` | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

---

## 4. Business Logic & Rules

### 4.1 Subject linking

- A project **must** be linked to at least 1 Subject.
- A project **may not** be linked to more than 2 Subjects.
- Subjects must belong to the same family (or be platform-seeded subjects).
- Subject links may be changed at any time while the project is in `draft` or `active` status.

### 4.2 Child assignment

- A project must be assigned to at least 1 child.
- All assigned children must belong to the same family as the project.
- Children may be added or removed while the project is `draft` or `active`.
- Removing a child from a project does **not** delete their work entries or portfolio entries.

### 4.3 Milestone scaffolding

When a new project is created, the system automatically inserts four default milestones:

| Position | Title | Phase |
|---|---|---|
| 1 | Research | `research` |
| 2 | Create | `create` |
| 3 | Present | `present` |
| 4 | Reflect | `reflect` |

The parent may edit, reorder, add, or delete milestones at any time. The minimum number of milestones is 1. There is no enforced maximum.

### 4.4 Milestone ordering

- `position` is 1-based and must be unique within a project.
- When a milestone is reordered, all affected `position` values are recalculated contiguously (no gaps).
- Milestones within a project are displayed in ascending `position` order.

### 4.5 Project status transitions

```
draft → active
active → completed
active → draft         (revert, e.g. project was started too early)
completed → active     (reopen)
any → archived
archived → draft       (unarchive)
```

- Transitioning to `completed` does not require all milestones to be `completed` or `skipped` — the parent may override. The system **warns** the parent if one or more milestones are still `pending` or `in_progress` before completing.
- Archiving is a soft delete. Archived projects are excluded from all default list views but remain in the database and are accessible via an explicit "Show archived" toggle.

### 4.6 Portfolio entry creation

- Portfolio entries are created at the parent's explicit instruction, triggered by a prompt shown when a project is marked `completed`.
- The prompt is also accessible from the project detail page at any time while the project is `completed`.
- One portfolio entry is created **per assigned child**. If a project has 3 assigned children, the prompt creates 3 portfolio entries in a single operation, each with the same initial title and a blank summary.
- The parent can then edit each child's portfolio entry individually (title, summary, cover image).
- A portfolio entry starts as an unpublished draft (`published_at = NULL`). The parent explicitly publishes it.
- Multiple portfolio entries can be created from the same project (e.g. if children are added after initial completion). Duplicate entries per child per project are prevented at the database level via a unique constraint on `(project_id, child_id)`.

### 4.7 Work entries and attachments

- Work entries are always authored by a parent (never by a child directly).
- A work entry may be scoped to a specific child (for differentiated notes) or left unscoped (applies to the project generally).
- Attachments may be uploaded independently of work entries, or linked to a specific entry or milestone.
- Deleting a work entry does not cascade-delete its attachments; orphaned attachments remain on the project.

### 4.8 Permissions

- Only authenticated users belonging to the same family may view, create, or modify that family's projects.
- No cross-family visibility exists in this spec (community sharing is deferred — see §7).

---

## 5. UX Flows

### 5.1 Create project

A project is created through a lightweight wizard (not a full-page wizard like family onboarding — a modal or slide-out panel is appropriate):

**Step 1 — Basics**
- Title (required)
- Description (optional, rich text or plain text)
- Start date / end date (both optional)

**Step 2 — Subjects**
- Select 1 or 2 Subjects from the family's subject catalog
- UI must prevent selection of a third subject

**Step 3 — Children**
- Select one or more children to assign
- If only one child exists in the family, they are pre-selected

On submission, the project is created in `draft` status with the four default milestones scaffolded automatically. The parent is taken directly to the project detail view.

### 5.2 Project detail view

The project detail view is the primary workspace. It contains:

**Header area**
- Title, description (editable inline)
- Subject tags (linked to subject detail)
- Assigned children (avatar chips)
- Date range
- Status badge with a status-change action (e.g. "Start project", "Mark complete")

**Milestones section**
- Ordered list of milestones
- Each milestone shows: title, phase badge, due date (if set), status, and a completion toggle
- Milestones can be reordered via drag-and-drop (`@dnd-kit`)
- Inline controls to add a new milestone (appended at the end) or insert between existing milestones
- Clicking a milestone expands it to show description and work entries scoped to that milestone

**Work log section**
- Chronological list of all work entries for the project (not filtered by milestone)
- Each entry shows: note text, child scoping (if any), milestone association (if any), attachments, timestamp
- "Add entry" button opens an inline composer

**Attachments section**
- Grid of all attachments on the project, regardless of milestone or entry association
- Upload control

**Portfolio section** (visible only when project is `completed`)
- If no portfolio entries exist yet: prompt with a "Create portfolio entries" CTA
- If portfolio entries exist: list of entries per child with title, published status, and a link to edit each entry

### 5.3 Milestone detail (expanded)

When a milestone row is expanded:
- Full description (editable)
- Due date (editable)
- Phase (editable, dropdown of `milestone_phase` enum values)
- Work entries scoped to this milestone
- Attachments scoped to this milestone
- Status selector (pending / in_progress / completed / skipped)
- Delete milestone action (with confirmation; not available if milestone has associated work entries or attachments — parent must reassign or delete those first)

### 5.4 Mark project complete

When the parent triggers "Mark complete":
- If any milestones are `pending` or `in_progress`: show a warning modal listing the incomplete milestones with the option to proceed anyway or cancel.
- On confirmation, project status is set to `completed`.
- Immediately after, the system shows a prompt: "Would you like to add this project to [child name]'s portfolio?" — one prompt that covers all assigned children. The parent can accept, defer, or dismiss.

### 5.5 Portfolio entry editing

A portfolio entry editor allows the parent to set:
- Title (pre-filled from project title)
- Summary (rich text, parent's reflection on the child's work and growth)
- Cover image (select from project attachments, or upload new)
- Publish / unpublish toggle

### 5.6 Projects list view

A top-level "Projects" section accessible from the main navigation, scoped to the family.

**Filters:**
- Status (all / draft / active / completed / archived)
- Child (all children / specific child)
- Subject (any / specific subject)

**Sort options:**
- Last updated (default)
- Start date
- Title

Each row in the list shows: title, status badge, assigned children avatars, linked subject tags, milestone progress (e.g. "2 / 4 milestones complete"), and last-updated timestamp.

### 5.7 Child portfolio view

A read-only per-child portfolio page listing all published portfolio entries for that child. Each entry shows: title, summary excerpt, linked project, subject tags, cover image (if set), and publication date.

This view is accessible from the child's profile page.

---

## 6. Seeded / Platform Data

No platform-seeded project templates are provided in this spec. Project scaffolding comes only from the four default milestones (§4.3). Platform-provided project templates are deferred to a future spec.

---

## 7. Out of Scope / Deferred

The following are explicitly excluded from this spec:

- **Community project sharing** — sharing a project or portfolio entry with other families, or browsing community projects
- **AI-generated project plans** — the AI assistant generating a project with milestones based on a subject and child profile (deferred to the AI Assistant spec)
- **PDF portfolio export** — exporting a child's portfolio or a single portfolio entry to PDF (deferred to a reporting/export spec)
- **Co-op projects** — projects shared across multiple families (deferred to the Community spec)
- **Per-milestone grading or rubrics** — attaching a rubric or score to a milestone or project (deferred to the Assessment spec)
- **Direct child interaction** — children logging their own work entries or viewing the project workspace (Oikos is parent-mediated)
- **Platform project templates** — curated starter projects by subject, philosophy, or age
- **Notifications** — reminders for approaching milestone due dates
- **Resource linking on projects** — linking Resource library items directly to a project or milestone (deferred; resources are currently linked at the Subject level)

---

## 8. Migration Notes

This spec introduces the following new tables requiring Alembic migrations:

- `projects`
- `project_subjects`
- `project_children`
- `project_milestones`
- `project_work_entries`
- `project_attachments`
- `portfolio_entries`

New enums:
- `project_status`
- `milestone_phase`
- `milestone_status`

No changes are required to existing tables in SPEC-001 through SPEC-005.
