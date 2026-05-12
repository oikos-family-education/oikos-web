# Lesson Planner — Feature Specification

## Overview

Parents and educators can create rich, structured lessons tied to a subject. Lessons can be planned days or weeks in advance and appear on the dashboard on their scheduled date. Associations with children, curricula, and projects flow naturally through the subject's existing relationships — a lesson does not duplicate those links directly.

---

## Problem Being Solved

The platform tracks *what* families study (subjects, curriculums) and *when* broadly (week planner routines), but has no place to compose the actual lesson — the objectives, activities, reading lists, embedded links, and educator notes for a specific teaching session. Without this, parents plan curriculum outside the app and lose the connection between planning and execution.

---

## Core Concepts

| Concept | Description |
|---|---|
| **Lesson** | A single planned teaching session for one subject on a specific date |
| **Lesson Block** | A rich-content section inside a lesson (text, link, resource, checklist) |
| **Lesson Status** | `draft → scheduled → in_progress → completed → cancelled` |

A lesson belongs to exactly one subject (and therefore one family). Children, curricula, and projects associated with a lesson are **not stored on the lesson itself** — they are resolved at query time through the subject's existing relationships:

- **Children** → subject → `CurriculumSubject` → `ChildCurriculum` → `Child`
- **Curricula** → subject → `CurriculumSubject` → `Curriculum`
- **Projects** → subject → `ProjectSubject` → `Project`

Its `scheduled_for` date is the single source of truth for "today's lessons" queries.

---

## Data Model

### `Lesson` table

```
id                  UUID, PK
family_id           UUID, FK(families), NOT NULL, CASCADE
subject_id          UUID, FK(subjects), NOT NULL
created_by_user_id  UUID, FK(users), NOT NULL

# scheduling
scheduled_for       DATE, NOT NULL, indexed      -- the calendar date
estimated_duration_minutes  SMALLINT, nullable   -- planned length

# metadata
title               VARCHAR(255), NOT NULL
status              VARCHAR(20), default 'draft'
  -- enum: draft, scheduled, in_progress, completed, cancelled
objectives          TEXT[], default []           -- learning goals for this lesson
tags                TEXT[], default []

# actual execution tracking (filled in post-lesson)
actual_duration_minutes  SMALLINT, nullable
completion_notes    TEXT, nullable
taught_on           DATE, nullable               -- actual date if different from plan

created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

There are **no direct foreign keys** to `children`, `curriculums`, or `projects`. Those associations are fully derived from the subject at query time.

**Index on:** `(family_id, scheduled_for)`, `subject_id`.

---

### `LessonBlock` table

The body of a lesson is composed of ordered blocks — similar to Notion or Google Docs section model. Each block has a type and a JSON payload.

```
id          UUID, PK
lesson_id   UUID, FK(lessons, CASCADE), NOT NULL
sort_order  SMALLINT, NOT NULL, default 0

type        VARCHAR(30), NOT NULL
  -- enum: text, heading, link, resource_ref, checklist,
  --        image_url, video_embed, divider, callout

content     JSONB, NOT NULL    -- type-specific payload (see Block Payloads)

created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

**Index on:** `(lesson_id, sort_order)`.

#### Block Payloads by Type

| Type | JSONB fields |
|---|---|
| `text` | `{ "html": "<p>...</p>" }` — sanitised rich text |
| `heading` | `{ "level": 2, "text": "Introduction" }` |
| `link` | `{ "url": "https://...", "title": "...", "description": "...", "favicon_url": "..." }` |
| `resource_ref` | `{ "resource_id": "uuid", "title": "...", "type": "book" }` — reference to existing Resource |
| `checklist` | `{ "items": [{ "id": "uuid", "text": "...", "checked": false }] }` |
| `image_url` | `{ "url": "https://...", "alt": "...", "caption": "..." }` |
| `video_embed` | `{ "url": "https://youtube.com/...", "embed_url": "https://...", "title": "..." }` |
| `divider` | `{}` |
| `callout` | `{ "icon": "💡", "text": "...", "color": "blue" }` |

`html` content in `text` blocks must be server-side sanitised (allow: `p, b, i, u, s, a, ul, ol, li, blockquote, code, pre, h3, h4, br`).

---

### Relationships to Existing Models

```
Lesson ──────────────── Subject          (required — the single anchor)
Lesson ──────────────── Family           (required, scoping)
Lesson ──────────────── User             (created_by)
Lesson 1──* LessonBlock

# Derived read-only relationships (via Subject, never stored on Lesson)
Lesson → Subject → CurriculumSubject → Curriculum    (which curricula include this lesson's subject)
Lesson → Subject → CurriculumSubject → ChildCurriculum → Child  (which children study this subject)
Lesson → Subject → ProjectSubject → Project          (which projects involve this subject)
```

A `TeachingLog` can optionally reference a `lesson_id` so that marking a lesson complete auto-creates a teaching log entry.

```
# Add to TeachingLog
lesson_id   UUID, FK(lessons), nullable, indexed
```

---

## API Endpoints

All routes require `get_current_user` and validate `family_id` ownership.

### Lessons CRUD

```
GET    /api/v1/lessons
       Query: from=YYYY-MM-DD, to=YYYY-MM-DD, subject_id=, status=,
              child_id=, curriculum_id=, project_id=,
              q=, limit=50, offset=0
       Response: LessonListResponse { items: LessonSummary[], total: int }

       # child_id filter  → JOIN subjects → curriculum_subjects → child_curriculums
                            returns lessons whose subject is enrolled for that child
       # curriculum_id    → JOIN subjects → curriculum_subjects
                            returns lessons whose subject belongs to that curriculum
       # project_id       → JOIN subjects → project_subjects
                            returns lessons whose subject is linked to that project

GET    /api/v1/lessons/today
       Response: list[LessonSummary]           ← used by dashboard

GET    /api/v1/lessons/{lesson_id}
       Response: LessonResponse                ← includes full blocks list

POST   /api/v1/lessons
       Body: LessonCreate
       Response: LessonResponse  201

PATCH  /api/v1/lessons/{lesson_id}
       Body: LessonUpdate
       Response: LessonResponse

PATCH  /api/v1/lessons/{lesson_id}/status
       Body: { "status": "completed", "actual_duration_minutes": 45,
               "completion_notes": "...", "taught_on": "2026-05-07",
               "create_teaching_log": true }
       Response: LessonResponse
       Side-effect: if create_teaching_log=true, creates one TeachingLog entry per child
                    currently enrolled in the lesson's subject (resolved via
                    subject → curriculum_subjects → child_curriculums).
                    If no children are enrolled, creates a family-level log with child_id=null.

DELETE /api/v1/lessons/{lesson_id}
       Response: 204
```

### Blocks CRUD (sub-resource)

```
GET    /api/v1/lessons/{lesson_id}/blocks
       Response: list[LessonBlockResponse]

POST   /api/v1/lessons/{lesson_id}/blocks
       Body: LessonBlockCreate  { type, content, sort_order? }
       Response: LessonBlockResponse  201

PATCH  /api/v1/lessons/{lesson_id}/blocks/{block_id}
       Body: LessonBlockUpdate  { content?, sort_order? }
       Response: LessonBlockResponse

PUT    /api/v1/lessons/{lesson_id}/blocks/reorder
       Body: { "order": ["uuid1", "uuid2", ...] }
       Response: list[LessonBlockResponse]

DELETE /api/v1/lessons/{lesson_id}/blocks/{block_id}
       Response: 204
```

### Convenience Endpoints

```
GET    /api/v1/lessons/week?week_start=YYYY-MM-DD
       Response: { [date: string]: LessonSummary[] }   ← 7-day view for week planner

POST   /api/v1/lessons/{lesson_id}/duplicate
       Body: { "scheduled_for": "YYYY-MM-DD" }
       Response: LessonResponse  201   ← full copy with all blocks
```

---

## Pydantic Schemas

```python
# LessonCreate
class LessonCreate(BaseModel):
    title: str
    subject_id: UUID
    scheduled_for: date
    estimated_duration_minutes: int | None = None
    objectives: list[str] = []
    tags: list[str] = []

# LessonUpdate  (all optional)
class LessonUpdate(BaseModel):
    title: str | None = None
    scheduled_for: date | None = None
    estimated_duration_minutes: int | None = None
    objectives: list[str] | None = None
    tags: list[str] | None = None

# SubjectMinimal  (embedded in every lesson response)
class SubjectMinimal(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    name: str
    color: str | None
    icon: str | None
    # derived at serialisation time — not stored on lesson
    curriculum_ids: list[UUID]   # curricula that include this subject
    child_ids: list[UUID]        # children enrolled in this subject
    project_ids: list[UUID]      # projects linked to this subject

# LessonSummary (list view — no blocks)
class LessonSummary(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    title: str
    status: str
    scheduled_for: date
    estimated_duration_minutes: int | None
    subject: SubjectMinimal
    tags: list[str]

# LessonResponse (detail view — with blocks)
class LessonResponse(LessonSummary):
    objectives: list[str]
    actual_duration_minutes: int | None
    completion_notes: str | None
    taught_on: date | None
    blocks: list[LessonBlockResponse]
    created_by_user_id: UUID
    created_at: datetime
    updated_at: datetime

# LessonBlockCreate
class LessonBlockCreate(BaseModel):
    type: str   # validated against allowed enum
    content: dict
    sort_order: int | None = None

# LessonBlockResponse
class LessonBlockResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    lesson_id: UUID
    type: str
    content: dict
    sort_order: int
    created_at: datetime
    updated_at: datetime
```

---

## Frontend Pages and Components

### Route Structure

```
app/[locale]/(dashboard)/lessons/page.tsx          ← lesson list / week view
app/[locale]/(dashboard)/lessons/new/page.tsx      ← lesson creation
app/[locale]/(dashboard)/lessons/[id]/page.tsx     ← lesson detail / editor
```

All three routes must be added to `PROTECTED_PATHS` in `apps/web/middleware.ts`.

---

### Lesson List Page (`/lessons`)

**Layout:** week-at-a-glance calendar strip at the top (Mon–Sun), lesson cards per day below.

**Components:**
- `LessonWeekStrip` — 7 clickable day columns, each shows lesson count badge
- `LessonDayGroup` — expandable group of `LessonCard` for one day
- `LessonCard` — subject color stripe, title, status badge, estimated duration, derived child avatars (from subject), "Open" and status-toggle actions
- Filters sidebar: Subject, Status, Date range — plus secondary filters Child / Curriculum / Project that are resolved through the subject (clearly labelled "Filter by subject's children/curricula/projects")

**Interactions:**
- Click a day in the strip to jump to that day's group
- "New lesson" button opens the creation page with `scheduled_for` pre-filled to the clicked date
- Inline status toggle from `draft`/`scheduled` → `completed` without leaving the list

---

### Lesson Editor Page (`/lessons/new` and `/lessons/[id]`)

This is the rich composition page. It has two panels:

#### Left Panel — Lesson Metadata (sidebar, collapsible on mobile)

```
Title (text input, required *)
Subject (select, required *)
Scheduled for (date picker, required *)
Estimated duration (number input, minutes)
Objectives (tag input — add/remove text items)
Tags (tag input)
Status badge + "Mark complete" CTA
```

Below the editable fields, a read-only **"Via Subject"** section surfaces the relationships derived from the chosen subject:

```
Children        — avatar list of children enrolled in this subject
Curricula       — pill list of curricula that include this subject
Projects        — pill list of projects linked to this subject
```

These are informational only — to change them, the user edits the subject or curriculum/project, not the lesson.
If no subject is selected yet, this section shows a placeholder: *"Select a subject to see related children, curricula, and projects."*

#### Right Panel — Block Editor (main content area)

A vertically ordered list of blocks. Each block:
- Drag handle (⠿) on left for reordering
- Block type indicator (icon)
- Content area (type-specific)
- Hover toolbar: duplicate, delete

**Block Toolbar (add new block):** A `+` button below each block (and at bottom of list) opens an inline picker:

```
📝 Text         — rich text (bold, italic, underline, lists, blockquote, code)
🔤 Heading      — H2 or H3
🔗 Link         — URL with auto-fetch of title/description via /api/v1/lessons/link-preview
📚 Resource     — pick from family resources library
✅ Checklist    — interactive todo list
🖼 Image URL    — external image by URL
🎬 Video        — YouTube / Vimeo embed
— Divider       — horizontal rule
💡 Callout      — highlighted note box with emoji + color
```

**Rich Text Block (ProseMirror-based, via `@tiptap/react`):**
- Toolbar: Bold, Italic, Underline, Strikethrough, Inline code, Link, Bullet list, Numbered list, Blockquote
- Keyboard shortcuts: `Cmd+B`, `Cmd+I`, `Cmd+K` (link dialog)
- Auto-saves to server on 2-second debounce (PATCH lesson + PATCH block)

**Link Block:** On URL paste/submit, `POST /api/v1/lessons/link-preview?url=…` returns `{ title, description, favicon_url }` to populate the block card. Displayed as a rich card with title, description, favicon, and clickable URL.

**Resource Block:** Searchable dropdown of existing `Resource` records in the family library. Renders as a card showing resource type icon, title, author.

**Checklist Block:** Each item has a checkbox (local state only — not persisted to backend in real-time; full block PATCH on blur/check).

---

### Link Preview Endpoint (new)

```
GET /api/v1/lessons/link-preview?url=https://...
Response: { "url": str, "title": str | None, "description": str | None, "favicon_url": str | None }
```

Server-side fetch with 5-second timeout and allow-list of safe URL schemes (`https`, `http`). Returns empty strings on failure — never 500s. No auth required at the endpoint level (family validated via cookie).

---

### Dashboard Integration

Add a new `TodayLessons` widget to the dashboard, positioned in the **left column** directly below `TodaySchedule`.

**`TodayLessons` component:**
- Calls `GET /api/v1/lessons/today`
- Displays a card per lesson: subject color stripe, lesson title, status badge, estimated duration
- Empty state: "No lessons planned for today — [Plan a lesson]"
- Click a card → navigates to `/lessons/{id}`
- Inline "Mark complete" button on each `scheduled`/`in_progress` lesson — triggers status PATCH, shows completion dialog (actual duration + notes, optional auto-create teaching log)

**Dashboard data fetch:** Add to the existing dashboard data loading pattern (parallel fetch alongside today's routine entries).

---

## i18n Keys

Add a `Lessons` namespace to `apps/web/messages/en.json`:

```json
"Lessons": {
  "pageTitle": "Lesson Planner",
  "newLesson": "New Lesson",
  "editLesson": "Edit Lesson",
  "lessonTitle": "Lesson Title",
  "subject": "Subject",
  "scheduledFor": "Scheduled For",
  "estimatedDuration": "Estimated Duration",
  "estimatedDurationUnit": "minutes",
  "objectives": "Learning Objectives",
  "tags": "Tags",
  "viaSubject": "Via Subject",
  "viaSubjectChildren": "Children",
  "viaSubjectCurricula": "Curricula",
  "viaSubjectProjects": "Projects",
  "viaSubjectPlaceholder": "Select a subject to see related children, curricula, and projects.",
  "status": "Status",
  "statusDraft": "Draft",
  "statusScheduled": "Scheduled",
  "statusInProgress": "In Progress",
  "statusCompleted": "Completed",
  "statusCancelled": "Cancelled",
  "markComplete": "Mark Complete",
  "addBlock": "Add Block",
  "blockText": "Text",
  "blockHeading": "Heading",
  "blockLink": "Link",
  "blockResource": "Resource",
  "blockChecklist": "Checklist",
  "blockImageUrl": "Image",
  "blockVideoEmbed": "Video",
  "blockDivider": "Divider",
  "blockCallout": "Callout",
  "completionDialog": "Complete Lesson",
  "actualDuration": "Actual Duration",
  "completionNotes": "Notes",
  "createTeachingLog": "Log teaching time automatically",
  "taughtOn": "Taught On",
  "duplicateLesson": "Duplicate Lesson",
  "duplicateScheduledFor": "New Date",
  "noLessonsToday": "No lessons planned for today",
  "planLesson": "Plan a lesson",
  "emptyState": "No lessons found",
  "emptyStateAction": "Create your first lesson",
  "weekView": "Week View",
  "linkPreviewLoading": "Fetching link preview...",
  "linkPlaceholder": "Paste a URL",
  "objectivePlaceholder": "Add a learning objective",
  "saved": "Saved",
  "saving": "Saving...",
  "deleteBlock": "Delete block",
  "duplicateBlock": "Duplicate block",
  "dragToReorder": "Drag to reorder"
}
```

Also add to `Dashboard` namespace:

```json
"todayLessons": "Today's Lessons",
"noLessonsToday": "No lessons planned today"
```

---

## New npm Dependency

`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-underline`, `@tiptap/extension-code-block` — rich text editing in the `apps/web` package only. These are MIT-licensed and tree-shaken per component.

`dnd-kit` (`@dnd-kit/core`, `@dnd-kit/sortable`) — already used or to be added for block drag-and-drop reordering.

---

## Backend Tests

File: `apps/api/tests/test_lessons.py`

### Fixtures needed (add to `conftest.py`)
- `lesson` — a `Lesson` record linked to the authed family's subject
- `lesson_with_blocks` — lesson with 3 blocks (text, link, checklist)

### Test cases

**CRUD**
- `test_create_lesson_success` — POST, 201, response includes `subject.child_ids`, `subject.curriculum_ids`, `subject.project_ids` derived from subject relationships
- `test_create_lesson_missing_subject` — POST with non-existent subject_id → 404
- `test_create_lesson_other_family_subject` — subject belongs to another family → 403
- `test_list_lessons_no_filter` — GET list returns family's lessons only
- `test_list_lessons_date_range` — `from`/`to` filter returns correct subset
- `test_list_lessons_by_subject` — `subject_id` filter
- `test_list_lessons_by_child` — `child_id` filter joins through `curriculum_subjects → child_curriculums`; returns lessons whose subject is enrolled for that child; lessons for other subjects not returned
- `test_list_lessons_by_curriculum` — `curriculum_id` filter joins through `curriculum_subjects`; returns lessons whose subject belongs to that curriculum
- `test_list_lessons_by_project` — `project_id` filter joins through `project_subjects`; returns lessons whose subject is linked to that project
- `test_list_lessons_by_status` — `status` filter
- `test_get_lesson_detail` — GET `/{id}`, includes blocks list and populated `subject.child_ids` / `subject.curriculum_ids` / `subject.project_ids`
- `test_get_lesson_other_family` → 403
- `test_update_lesson` — PATCH title, scheduled_for, objectives, tags
- `test_delete_lesson` — DELETE, 204, verify gone
- `test_delete_lesson_cascades_blocks` — verify blocks removed

**Status transitions**
- `test_mark_lesson_complete_creates_teaching_log_per_child` — status PATCH with `create_teaching_log=true` creates one `TeachingLog` per child enrolled in the lesson's subject (via curriculum_subjects → child_curriculums); each log has correct `subject_id`, `child_id`, `minutes`, `taught_on`, `lesson_id`
- `test_mark_lesson_complete_no_enrolled_children_creates_family_log` — when no children are enrolled in the subject, creates a single log with `child_id=null`
- `test_mark_lesson_complete_no_log` — with `create_teaching_log=false`, no teaching log created
- `test_invalid_status_transition` — e.g. `cancelled → completed` → 422

**Today endpoint**
- `test_today_returns_scheduled_lessons` — lessons with `scheduled_for = today` appear
- `test_today_excludes_other_dates` — past/future lessons not included
- `test_today_excludes_completed` — completed lessons not shown (or show with completed badge, spec: include all non-cancelled)
- `test_today_excludes_other_family` — other family's lessons not returned

**Week endpoint**
- `test_week_view_groups_by_date` — 7 keys, each date maps to correct lessons

**Blocks CRUD**
- `test_create_block_text` — POST block, 201, sort_order auto-assigned
- `test_create_block_invalid_type` → 422
- `test_create_block_link_sanitised` — link with javascript: scheme rejected → 422
- `test_list_blocks_ordered` — blocks returned by `sort_order` ASC
- `test_update_block_content`
- `test_reorder_blocks` — PUT `/reorder` with reversed order, verify new sort_orders
- `test_delete_block`
- `test_create_block_wrong_lesson_family` → 403

**Duplicate lesson**
- `test_duplicate_lesson` — all metadata and blocks copied, new `scheduled_for` date

**Link preview endpoint**
- `test_link_preview_valid_url` — returns title/description (mock `httpx` fetch)
- `test_link_preview_non_https` — `ftp://` URL → 422
- `test_link_preview_fetch_error` — upstream timeout → returns empty strings, 200

**Cross-cutting**
- `test_unauthenticated_request` → 401 on all lesson endpoints
- `test_subject_derived_relations_scoped_to_family` — `child_ids`, `curriculum_ids`, `project_ids` in the response only include records belonging to the same family as the lesson; no data leaks from other families

---

## Frontend Tests

File: `apps/web/tests/lessons/lessonUtils.test.ts`

```typescript
// Status helpers
describe('getLessonStatusColor', () => {
  it('returns correct Tailwind class for each status')
})

describe('isLessonActionable', () => {
  it('returns true for draft and scheduled')
  it('returns false for completed and cancelled')
})

describe('groupLessonsByDate', () => {
  it('groups an array of lessons into a date-keyed map')
  it('returns empty object for empty input')
  it('sorts dates ascending within each day group')
})

describe('buildLessonWeekDays', () => {
  it('returns 7 dates starting from provided week_start')
  it('annotates each day with the lesson list from the grouped map')
  it('fills days with no lessons as empty arrays')
})
```

File: `apps/web/tests/lessons/TodayLessons.test.tsx`

```typescript
describe('TodayLessons widget', () => {
  it('renders a lesson card for each lesson returned by the API')
  it('shows empty state when API returns empty list')
  it('shows loading skeleton while fetching')
  it('clicking a lesson card navigates to /lessons/{id}')
  it('mark-complete button calls PATCH /lessons/{id}/status')
  it('does not render mark-complete for completed lessons')
})
```

---

## Alembic Migration

New file: `apps/api/alembic/versions/XXXX_add_lessons_table.py`

```
1. Create `lessons` table — FKs to families, subjects, users only; no FK to curriculums, projects, or children
2. Create `lesson_blocks` table with FK to lessons (ON DELETE CASCADE)
3. ALTER TABLE `teaching_logs` ADD COLUMN `lesson_id` UUID REFERENCES lessons(id) ON DELETE SET NULL
```

---

## Implementation Order

1. **Alembic migration** — create `lessons` + `lesson_blocks`, alter `teaching_logs`
2. **ORM models** — `Lesson`, `LessonBlock`, update `TeachingLog`
3. **Pydantic schemas** — `lesson.py`, `lesson_block.py`
4. **Services** — `lesson_service.py` (CRUD, status transitions, teaching log side-effect, link preview fetch)
5. **Routers** — `lessons.py`, register in `main.py`
6. **Backend tests** — `test_lessons.py`
7. **Frontend utility functions** — `apps/web/lib/lessonUtils.ts`
8. **Translation keys** — add `Lessons` namespace to `en.json`
9. **Lesson list page** — `LessonWeekStrip`, `LessonDayGroup`, `LessonCard`
10. **Lesson editor page** — metadata sidebar + block editor with Tiptap
11. **Dashboard widget** — `TodayLessons` component, wire into `dashboard/page.tsx`
12. **Frontend tests** — `lessonUtils.test.ts`, `TodayLessons.test.tsx`

---

## Open Questions

1. **Offline / local-first editing** — should block saves be optimistic (local update first, sync on debounce)? The current spec assumes standard async fetch; if offline support is added later, blocks would need a local queue.
2. **Shared lessons** — should families be able to publish lesson templates to the community (like subjects)? Not in scope for v1.
3. **Attachments / file uploads** — image blocks currently reference external URLs. A future version could support direct file upload to S3/R2. Not in scope for v1.
4. **Recurring lessons** — should a lesson repeat weekly (similar to CalendarEvent recurrence)? Not in scope for v1; can be added via a `recurrence` field later.
5. **Notification / reminder** — should parents get a push/email reminder on the morning of a scheduled lesson? Not in scope for v1.
