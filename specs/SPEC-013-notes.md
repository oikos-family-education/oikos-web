# SPEC-013 — Notes
**Version:** 1.0
**Depends on:** SPEC-001 (auth), SPEC-002 (family & children), SPEC-003 (navigation shell), SPEC-004 (subjects & curriculum), SPEC-006/009 (projects), SPEC-007 (resources), SPEC-010 (calendar)

---

## 1. Overview

The **Notes** page (`/notes`) is the family's unified capture layer — a single place where both the primary parent and the co-educator can write, track, and retrieve notes that are optionally linked to any entity in the platform (a child, a subject, a resource, a calendar event, or a project), or left as standalone family-level notes.

This page replaces the "Journal" placeholder at [apps/web/app/[locale]/(dashboard)/journal/page.tsx](apps/web/app/[locale]/(dashboard)/journal/page.tsx). As part of this work, the sidebar label **"Journal" is renamed to "Notes"** and the route changes from `/journal` to `/notes`.

Notes are not just freeform text — they carry a **status** that makes them actionable (`TODO`, `IN_PROGRESS`) or archival (`HISTORY_ONLY`, `ARCHIVED`), turning the page into a lightweight task-and-reflection system that sits naturally alongside the planner and progress tracker.

---

## 2. Goals

- Give both parents a single, always-accessible place to capture anything — a thought, a task, a milestone, a concern — without navigating to a specific entity first.
- Let every note optionally "belong" to a specific entity so that context is preserved and notes surface in the right places later (e.g., a note linked to a subject appears in the subject's detail panel).
- Replace the actionless Journal placeholder with real functionality while keeping the data model simple enough to build quickly.
- Support enough views (list, board, timeline) to serve different mental models without over-engineering.

---

## 3. Out of Scope / Deferred

| Item | Reason |
|---|---|
| Rich text / WYSIWYG editor | v1 uses plain Markdown textarea; rich text is a future enhancement |
| File/image attachments | Post-MVP — adds storage complexity |
| Note sharing outside the family (e.g., with a tutor) | Community / sharing spec |
| Notifications / reminders for due dates | Notifications spec |
| AI-assisted note generation or summarisation | Assistant spec |
| Per-note comments / threads | Post-MVP |
| More than two authors per family | Follows family membership limits in SPEC-012 |
| Linking a note to multiple entities simultaneously | v1 allows one entity link per note |

---

## 4. Core Concepts

| Term | Definition |
|---|---|
| **Note** | A text entry (title + body) created by a family member, with an optional entity link and a status |
| **General note** | A note with no entity link — belongs to the family as a whole |
| **Linked note** | A note associated with exactly one entity (child, subject, resource, event, or project) |
| **Status** | A single enum value on every note that signals its lifecycle stage (see §4.1) |
| **Author** | The family member (User) who created the note |
| **Entity type** | The kind of entity the note is linked to (`child`, `subject`, `resource`, `event`, `project`) |
| **Pin** | A boolean flag that keeps the note at the top of any listing |
| **Tag** | A free-form string label for cross-cutting grouping (e.g., `reading`, `math-co-op`, `prayer`) |

### 4.1 Note Statuses

| Status | Intent | Typical use |
|---|---|---|
| `DRAFT` | Being written, not yet ready | Incomplete thoughts, in-progress writeups |
| `TODO` | Action needed, not started | Tasks, follow-ups, things to buy |
| `IN_PROGRESS` | Being actively worked on | Multi-session activities, ongoing research |
| `TO_REMEMBER` | Important, no specific action | Milestones, observations, key decisions |
| `COMPLETED` | Done | Finished tasks, resolved items |
| `ARCHIVED` | Kept for reference but no longer active | Old notes, superseded plans |
| `HISTORY_ONLY` | Pure journal/diary entry — no actionable intent | Day-in-the-life logs, reflections, memories |

Status transitions are unrestricted — any status can move to any other status.

---

## 5. Data Model

### 5.1 `notes` table

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK, default `uuid4` | |
| `family_id` | `UUID` | FK → `families.id` ON DELETE CASCADE, indexed | Scopes the note to a family |
| `author_user_id` | `UUID` | FK → `users.id` ON DELETE SET NULL, indexed | The parent who wrote it |
| `title` | `VARCHAR(255)` | nullable | Optional short title |
| `content` | `TEXT` | not null | Markdown body |
| `status` | `VARCHAR(20)` | not null, default `'draft'` | Enum values in §4.1 |
| `entity_type` | `VARCHAR(20)` | nullable | `child`, `subject`, `resource`, `event`, `project` |
| `entity_id` | `UUID` | nullable | Polymorphic FK — validated in service layer |
| `tags` | `ARRAY(VARCHAR)` | not null, default `[]` | Free-form tags |
| `is_pinned` | `BOOLEAN` | not null, default `false` | |
| `due_date` | `DATE` | nullable | Meaningful for `TODO` / `IN_PROGRESS` |
| `created_at` | `TIMESTAMP WITH TZ` | not null, default `now()` | |
| `updated_at` | `TIMESTAMP WITH TZ` | not null, default `now()` | Updated on every PATCH |

**Indices:** `(family_id)`, `(family_id, status)`, `(family_id, entity_type, entity_id)`, `(family_id, author_user_id)`.

**Constraint:** `entity_id IS NULL OR entity_type IS NOT NULL` — if an entity ID is given, the type must also be given (enforced at the service layer via validation, not a DB constraint, to keep migrations simple).

### 5.2 Model file

`apps/api/app/models/note.py`

```python
import uuid
from sqlalchemy import Column, String, Text, Boolean, Date, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from app.models.mixins import TimestampMixin  # created_at / updated_at

class Note(TimestampMixin, Base):
    __tablename__ = "notes"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id      = Column(UUID(as_uuid=True), nullable=False, index=True)
    author_user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    title          = Column(String(255), nullable=True)
    content        = Column(Text, nullable=False)
    status         = Column(String(20), nullable=False, default="draft")
    entity_type    = Column(String(20), nullable=True)
    entity_id      = Column(UUID(as_uuid=True), nullable=True)
    tags           = Column(ARRAY(String), nullable=False, default=list)
    is_pinned      = Column(Boolean, nullable=False, default=False)
    due_date       = Column(Date, nullable=True)
```

---

## 6. API

All endpoints are under `/api/v1/notes` and require authentication (`Depends(get_current_user)`). The service verifies `current_user.family_id == note.family_id` before any mutation.

### 6.1 Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/notes` | List notes for the current family (filterable) |
| `POST` | `/api/v1/notes` | Create a new note |
| `GET` | `/api/v1/notes/{id}` | Get a single note |
| `PATCH` | `/api/v1/notes/{id}` | Update note fields |
| `DELETE` | `/api/v1/notes/{id}` | Delete a note |

### 6.2 `GET /api/v1/notes`

Query params:

| Param | Type | Description |
|---|---|---|
| `status` | `str` (repeatable) | Filter by one or more statuses |
| `entity_type` | `str` | Filter by entity type |
| `entity_id` | `UUID` | Filter by entity ID (requires `entity_type`) |
| `author_user_id` | `UUID` | Filter by author |
| `tag` | `str` (repeatable) | Notes that include ALL listed tags |
| `pinned` | `bool` | If `true`, return only pinned notes |
| `due_before` | `date` | Notes with `due_date <= due_before` |
| `q` | `str` | Full-text search across `title` and `content` (ILIKE) |
| `sort` | `str` | `created_at_desc` (default), `created_at_asc`, `updated_at_desc`, `due_date_asc` |
| `limit` | `int` | Default 50, max 200 |
| `offset` | `int` | For pagination |

Pinned notes always appear first regardless of sort order.

Response: `NoteListResponse` — `{ items: NoteResponse[], total: int }`.

### 6.3 `POST /api/v1/notes`

Status `201 Created`.

```json
{
  "content": "string (required)",
  "title": "string (optional)",
  "status": "draft | todo | in_progress | to_remember | completed | archived | history_only",
  "entity_type": "child | subject | resource | event | project | null",
  "entity_id": "uuid | null",
  "tags": ["string"],
  "is_pinned": false,
  "due_date": "2026-05-01 | null"
}
```

Service validates: if `entity_id` is set, the referenced entity must belong to `current_user.family_id` (look up in the corresponding table). Returns `404` if not found, `409` if entity type is invalid.

### 6.4 `PATCH /api/v1/notes/{id}`

Partial update — all fields optional. Same payload shape as POST. Changing `status` records `updated_at`. Returns updated `NoteResponse`.

### 6.5 `DELETE /api/v1/notes/{id}`

Hard delete. Returns `204 No Content`. No soft-delete in v1 — once deleted it is gone.

### 6.6 Schemas (`apps/api/app/schemas/note.py`)

```python
class NoteCreate(BaseModel):
    content: str
    title: str | None = None
    status: str = "draft"
    entity_type: str | None = None
    entity_id: UUID | None = None
    tags: list[str] = []
    is_pinned: bool = False
    due_date: date | None = None

class NoteUpdate(BaseModel):
    content: str | None = None
    title: str | None = None
    status: str | None = None
    entity_type: str | None = None
    entity_id: UUID | None = None
    tags: list[str] | None = None
    is_pinned: bool | None = None
    due_date: date | None = None

class NoteResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    family_id: UUID
    author_user_id: UUID | None
    author_name: str | None  # resolved in service: user.first_name + user.last_name
    title: str | None
    content: str
    status: str
    entity_type: str | None
    entity_id: UUID | None
    entity_label: str | None  # resolved in service: child.first_name, subject.name, etc.
    tags: list[str]
    is_pinned: bool
    due_date: date | None
    created_at: datetime
    updated_at: datetime
```

`author_name` and `entity_label` are resolved in the service layer by joining or doing a secondary query — they are denormalized in the response to avoid N+1 issues on the list endpoint.

---

## 7. Page Layout

Route: `/notes` (protected — must be listed in `PROTECTED_PATHS` in `apps/web/middleware.ts`).

Components live in `apps/web/components/notes/`.

### 7.1 Overall Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Notes                                   [+ Add note]       │
│  Your family's notes, tasks, and reflections.               │
├────────────────┬────────────────────────────────────────────┤
│  FILTERS       │  VIEW TOGGLE  [List] [Board] [Timeline]    │
│                │                                            │
│  All notes     │  ┌── pinned note ──────────────────────┐  │
│  ─────────     │  │ 📌 Buy microscope slides    [TODO]  │  │
│  By status     │  │ Science · Alice             Felipe  │  │
│  ○ Draft       │  │ Due May 3                   Apr 22  │  │
│  ○ Todo        │  └────────────────────────────────────┘  │
│  ○ In progress │                                            │
│  ○ To remember │  ┌── note ─────────────────────────────┐  │
│  ○ Completed   │  │ Reading log: Charlotte's Web [HIST] │  │
│  ○ Archived    │  │ General note                 Maria  │  │
│  ○ History     │  │ Apr 21                              │  │
│                │  └────────────────────────────────────┘  │
│  By entity     │                                            │
│  ○ General     │  ...                                       │
│  ○ Children    │                                            │
│  ○ Subjects    │                                            │
│  ○ Resources   │                                            │
│  ○ Events      │                                            │
│  ○ Projects    │                                            │
│                │                                            │
│  By author     │                                            │
│  ○ Felipe      │                                            │
│  ○ Maria       │                                            │
│                │                                            │
│  🔍 Search...  │                                            │
└────────────────┴────────────────────────────────────────────┘
```

### 7.2 Page Header

- Title: `text-2xl font-bold text-slate-800` — "Notes"
- Subtitle: `text-slate-500` — "Your family's notes, tasks, and reflections."
- **"+ Add note"** button (primary, top-right): opens the Add Note drawer.

### 7.3 Left Filter Panel

A sticky left sidebar (collapsible on mobile, always visible on `lg:`):

- **Search box** — `q` param, debounced 300 ms, searches title + content.
- **Status filter** — checkbox list; multiple selectable. Selecting none = show all.
- **Entity type filter** — radio: All / General / Children / Subjects / Resources / Events / Projects.
- **Author filter** — only shown if co-parent exists; radio: All / [Primary parent name] / [Co-parent name].
- **Clear filters** link — resets all to defaults.

Filter state is held in URL query params so that links are shareable and refreshable.

### 7.4 View Modes

Toggle between three views (stored in `localStorage`):

#### List View (default)
Notes rendered as cards in a vertical stack. Pinned notes appear at the top with a pin icon. Each card shows:
- Pin icon (filled if pinned, outline otherwise — clickable to toggle)
- Title (or first line of content if no title)
- Content excerpt (up to 2 lines, truncated)
- Status badge (`rounded-full px-2 py-0.5 text-xs font-semibold` with status-appropriate color — see §7.6)
- Entity chip (`rounded-md bg-slate-100 text-xs text-slate-600`) showing `entity_label` if linked
- Author first name + avatar initial
- Due date (red if overdue) — only if set
- Created date (`text-xs text-slate-400`)
- Hover actions: Edit (pencil icon), Delete (trash icon)

#### Board View
Kanban columns — one per status in the order: Draft → Todo → In Progress → To Remember → Completed → Archived → History Only. Cards are minimal (title/excerpt + entity chip). Drag-and-drop between columns updates `status` via `PATCH`. Each column header shows the count.

#### Timeline View
Notes grouped by calendar date (created_at date) in reverse chronological order. Each day is a section header (`text-sm font-semibold text-slate-500 mb-2`). Useful for `HISTORY_ONLY` journal entries.

### 7.5 Add / Edit Note Drawer

A slide-in panel from the right (not a modal, so the list stays visible):

```
┌─────────────────────────────────┐
│  New note                  [✕]  │
│                                 │
│  Title (optional)               │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  Note *                         │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │   (Markdown textarea)     │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  Status *       [Draft      ▼]  │
│                                 │
│  Link to...     [None       ▼]  │
│    ↳ (shows entity selector     │
│       when type is chosen)      │
│                                 │
│  Tags           [+ add tag]     │
│                                 │
│  Due date       [Pick date]     │
│                                 │
│  📌 Pin this note               │
│                                 │
│       [Cancel]  [Save note]     │
└─────────────────────────────────┘
```

- **Link to** is a two-step selector: first choose the entity type (dropdown), then choose the specific entity (searchable dropdown populated by a lightweight list endpoint for each entity type).
- All fields except `content` and `status` are optional.
- Saving calls `POST /api/v1/notes` (create) or `PATCH /api/v1/notes/{id}` (edit).
- After save the drawer closes and the list refreshes.

### 7.6 Status Badge Colors

| Status | Badge style |
|---|---|
| `DRAFT` | `bg-slate-100 text-slate-600` |
| `TODO` | `bg-blue-100 text-blue-700` |
| `IN_PROGRESS` | `bg-amber-100 text-amber-700` |
| `TO_REMEMBER` | `bg-purple-100 text-purple-700` |
| `COMPLETED` | `bg-green-100 text-green-700` |
| `ARCHIVED` | `bg-slate-200 text-slate-500` |
| `HISTORY_ONLY` | `bg-rose-100 text-rose-700` |

### 7.7 Delete Confirmation

Clicking the trash icon on a card opens an inline confirmation: *"Delete this note? This cannot be undone."* with **Cancel** and **Delete** buttons. Calls `DELETE /api/v1/notes/{id}` and removes the card from the list optimistically.

### 7.8 Contextual Notes (Entity Surface)

Although not the primary surface for this spec, the Notes feature must expose a reusable `<NotesList entity_type="child" entity_id={id} />` component that can be embedded in child, subject, resource, event, and project detail views in future specs. This component renders the list + Add-note shortcut pre-filled with the entity context.

### 7.9 Empty States

| Context | Message |
|---|---|
| No notes at all | "You haven't added any notes yet. Tap '+ Add note' to get started." |
| No notes match filters | "No notes match your current filters." + "Clear filters" link |
| Board column empty | "(empty)" in light gray, centered |

---

## 8. Navigation Change

### 8.1 Sidebar

In [apps/web/components/dashboard/Sidebar.tsx](apps/web/components/dashboard/Sidebar.tsx):
- Change the `href` from `/journal` to `/notes`
- Change the `label` from `t('journal')` to `t('notes')`
- Keep the `PenTool` icon (or switch to `StickyNote` from lucide-react — product decision)

### 8.2 i18n

In `apps/web/messages/en.json`:
- Add `"notes"` key in the `Navigation` namespace: `"Notes"`
- Add `"notesDesc"` key in the `Placeholder` namespace (can be removed later): `"Your family's notes, tasks, and reflections"`
- Add a new `Notes` namespace for all page-level strings (status labels, filter labels, drawer headings, empty states)

### 8.3 Route redirect

Add a permanent redirect from `/[locale]/journal` → `/[locale]/notes` in `next.config.js` to avoid broken links from existing bookmarks.

### 8.4 Protected paths

Add `/notes` to the `PROTECTED_PATHS` array in `apps/web/middleware.ts`.  
Remove `/journal` from the array if it is currently listed.

---

## 9. Additional Functionalities

### 9.1 Quick-capture from anywhere
A global keyboard shortcut (`N` when not focused in an input) opens the Add Note drawer pre-filled with no entity link. Allows the user to capture thoughts without navigating to Notes first.

### 9.2 Due-date overdue indicator
Notes with `status` in `[TODO, IN_PROGRESS]` and `due_date < today` display the due date in `text-red-500` and show a small warning icon. The left filter panel has a shortcut filter: **"Overdue"**.

### 9.3 Tag management
Tags are free-form strings. The tag input autocompletes from tags already used by the family (fetched via `GET /api/v1/notes?tags_only=true` — returns `{ tags: string[] }`). Clicking a tag chip in the filter sidebar filters to notes with that tag.

### 9.4 Bulk actions (Board and List views)
Checkboxes appear on card hover. When one or more cards are selected, a floating action bar appears:
- **Change status** (bulk) — applies to all selected notes
- **Delete** (bulk) — confirms before deleting
- **Tag** (bulk) — adds a tag to all selected notes

### 9.5 Context-launch "Add note" from entity pages
Any entity detail page (child profile, subject detail, project detail, calendar event) shows an **"Add note"** button that opens the Notes drawer pre-filled with `entity_type` and `entity_id`. The created note then appears in the Notes page and in the entity's embedded note list.

### 9.6 Export
The Notes page header includes an **Export** button (secondary, small) that downloads all filtered notes as a Markdown file. Each note is a `## Title` section with metadata as YAML front-matter. Useful for archiving or printing.

### 9.7 Note count in sidebar
The sidebar `Notes` nav item shows a badge with the count of `TODO` + `IN_PROGRESS` notes that have a `due_date <= today + 3 days`. Fetched via a lightweight count endpoint: `GET /api/v1/notes/upcoming-count`. Returns `{ count: int }`. Badge only shown if `count > 0`.

---

## 10. Implementation Order

The feature should be built in the following phases:

| Phase | Deliverables |
|---|---|
| **1 — Data + API** | Alembic migration, `Note` model, `note_service.py`, `notes.py` router, schemas, register in `main.py` |
| **2 — Navigation rename** | Sidebar label/href change, i18n keys, redirect, middleware update |
| **3 — List view** | `NotesPage`, filter sidebar, list cards, status badges, empty states |
| **4 — Add/Edit drawer** | Drawer component, entity selector, form validation |
| **5 — Delete + Status change** | Inline delete confirmation, status dropdown on card |
| **6 — Board view** | Kanban columns, drag-and-drop status update |
| **7 — Timeline view** | Date-grouped reverse-chron list |
| **8 — Advanced** | Quick-capture shortcut, bulk actions, export, sidebar badge |

---

## 11. Files to Create / Modify

### New files
| File | Purpose |
|---|---|
| `apps/api/app/models/note.py` | SQLAlchemy Note model |
| `apps/api/app/schemas/note.py` | Pydantic Create/Update/Response schemas |
| `apps/api/app/services/note_service.py` | Business logic (CRUD + entity validation) |
| `apps/api/app/routers/notes.py` | FastAPI router |
| `apps/api/alembic/versions/<hash>_add_notes.py` | Alembic migration |
| `apps/web/app/[locale]/(dashboard)/notes/page.tsx` | Next.js page entry point |
| `apps/web/components/notes/NotesPage.tsx` | Main page component |
| `apps/web/components/notes/NoteCard.tsx` | Single note card (list view) |
| `apps/web/components/notes/NoteDrawer.tsx` | Add/edit slide-in drawer |
| `apps/web/components/notes/NoteFilters.tsx` | Left filter sidebar |
| `apps/web/components/notes/NoteBoard.tsx` | Kanban board view |
| `apps/web/components/notes/NoteTimeline.tsx` | Timeline view |
| `apps/web/components/notes/NotesList.tsx` | Reusable embedded list (for entity pages) |
| `apps/web/components/notes/StatusBadge.tsx` | Status pill component |

### Modified files
| File | Change |
|---|---|
| `apps/api/app/main.py` | Register `notes` router |
| `apps/web/components/dashboard/Sidebar.tsx` | Rename Journal → Notes, update href |
| `apps/web/messages/en.json` | Add `Navigation.notes`, `Notes.*` namespace |
| `apps/web/middleware.ts` | Add `/notes`, remove `/journal` from `PROTECTED_PATHS` |
| `next.config.js` | Add redirect `/journal` → `/notes` |
