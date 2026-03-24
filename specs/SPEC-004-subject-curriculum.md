# Oikos — Subject & Curriculum Feature Specification

> **For Claude Code:** This document is the implementation specification for the Subject and Curriculum features of the Oikos platform. Read it fully before writing any code. It covers data models, business logic, and UI behaviour. API design should be inferred from the data models and business logic — inspect the existing codebase conventions and follow them.

---

## 0. Naming Convention (Important)

The Oikos codebase previously used the term **Discipline** to refer to a field of study. This must be **renamed throughout the entire codebase** to **Subject** — in database tables, API routes, frontend components, labels, and documentation. Any existing references to `discipline` / `Discipline` / `DISCIPLINE` must be replaced with `subject` / `Subject` / `SUBJECT` accordingly.

---

## 1. Overview

The **Subject** and **Curriculum** features are the educational backbone of Oikos. They answer two questions every homeschooling parent faces daily:

- *What are we studying?* → **Subjects**
- *How are we studying it, and for how long?* → **Curriculum**

A **Subject** is a reusable definition of a field of study (e.g. "Mathematics", "Latin", "Scripture Memory"). Subjects exist independently of any child and can be shared across the platform. Oikos ships with a curated set of platform subjects out of the box.

A **Curriculum** is a plan that collects a set of Subjects with scheduling configuration, covering a defined period of time. A Curriculum can be assigned to one or more children (e.g. twins sharing the same plan). It is the central planning unit in Oikos — the thing that drives the weekly calendar, lesson tracking, and progress reporting.

---

## 2. Data Model

### 2.1 Subject

```sql
CREATE TABLE subjects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id             UUID REFERENCES families(id) ON DELETE CASCADE,
  -- NULL family_id = platform-provided subject, read-only for families

  -- Identity
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  short_description     TEXT,
  long_description      TEXT,                     -- Markdown

  -- Classification
  category              subject_category NOT NULL,

  -- Visual identity
  color                 TEXT NOT NULL DEFAULT '#6366F1',  -- Hex
  icon                  TEXT,                             -- Icon name from icon library

  -- Age & Grade guidance (informational, not enforced)
  min_age_years         SMALLINT,
  max_age_years         SMALLINT,
  min_grade_level       SMALLINT,
  max_grade_level       SMALLINT,

  -- Session defaults (overridable per curriculum)
  default_session_duration_minutes  SMALLINT DEFAULT 45,
  default_weekly_frequency          SMALLINT DEFAULT 5,

  -- Competencies
  learning_objectives   TEXT[],
  skills_targeted       TEXT[],
  prerequisite_subject_ids UUID[],

  -- Visibility
  is_platform_subject   BOOLEAN NOT NULL DEFAULT FALSE,
  is_public             BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit
  created_by_user_id    UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (family_id, slug),
  CONSTRAINT name_not_empty CHECK (char_length(trim(name)) > 0)
);
```

#### subject_category enum

```sql
CREATE TYPE subject_category AS ENUM (
  'core_academic',       -- Mathematics, Language Arts, History, Science
  'language',            -- Latin, Greek, Spanish, French, Sign Language
  'scripture_theology',  -- Bible, Scripture Memory, Catechism, Church History
  'arts',                -- Music, Visual Arts, Drama, Dance
  'physical',            -- Physical Education, Sports, Nature Study
  'practical_life',      -- Home Economics, Cooking, Gardening, Woodworking
  'logic_rhetoric',      -- Logic, Rhetoric, Debate, Philosophy
  'technology',          -- Computer Science, Typing, Digital Literacy, Coding
  'elective',            -- Family-defined elective
  'co_op',               -- Subjects taught through a co-op group
  'other'
);
```

---

### 2.2 Platform-Provided Subjects

Oikos ships with a seed set of subjects (`is_platform_subject = TRUE`, `family_id = NULL`). These are read-only. Families may fork any platform subject to create their own editable copy.

**Seed subjects (expand in seed data as needed):**

| Name | Category | Suggested ages |
|---|---|---|
| Early Literacy | core_academic | 3–7 |
| Early Numeracy | core_academic | 3–7 |
| Phonics | core_academic | 4–8 |
| Reading | core_academic | 5–12 |
| Handwriting / Penmanship | core_academic | 5–12 |
| Mathematics | core_academic | 5–18 |
| Language Arts / English | core_academic | 5–18 |
| Writing & Composition | core_academic | 8–18 |
| History & Geography | core_academic | 6–18 |
| Science | core_academic | 6–18 |
| Latin | language | 9–18 |
| Spanish | language | 5–18 |
| French | language | 5–18 |
| Scripture / Bible | scripture_theology | 4–18 |
| Catechism | scripture_theology | 6–16 |
| Church History | scripture_theology | 10–18 |
| Music Theory | arts | 6–18 |
| Instrument Practice | arts | 5–18 |
| Visual Arts | arts | 4–18 |
| Drama | arts | 5–18 |
| Nature Study | physical | 4–14 |
| Physical Education | physical | 4–18 |
| Logic | logic_rhetoric | 10–18 |
| Rhetoric | logic_rhetoric | 13–18 |
| Typing | technology | 7–14 |
| Computer Science | technology | 10–18 |
| Home Economics | practical_life | 8–18 |
| Gardening | practical_life | 5–18 |

---

### 2.3 Curriculum

```sql
CREATE TABLE curriculums (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,

  -- Identity
  name            TEXT NOT NULL,
  description     TEXT,

  -- Period
  period_type     curriculum_period_type NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  academic_year   TEXT,     -- e.g. "2025-2026"
  term_name       TEXT,     -- e.g. "Autumn Term", "Semester 1"

  -- Educational context
  education_philosophy  TEXT,

  -- Status lifecycle
  status          curriculum_status NOT NULL DEFAULT 'draft',

  -- Goals
  overall_goals   TEXT[],
  notes           TEXT,

  -- Audit
  created_by_user_id  UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_date_range CHECK (end_date > start_date),
  CONSTRAINT name_not_empty CHECK (char_length(trim(name)) > 0)
);
```

#### Enums

```sql
CREATE TYPE curriculum_period_type AS ENUM (
  'monthly',     -- ~4 weeks
  'quarterly',   -- ~13 weeks
  'semester',    -- ~18 weeks
  'annual',      -- ~36 weeks
  'custom'
);

CREATE TYPE curriculum_status AS ENUM (
  'draft',      -- Being planned, not yet active
  'active',     -- Currently in use
  'paused',     -- Temporarily paused
  'completed',  -- Period ended
  'archived',   -- Hidden from default views
  'template'    -- Saved as a reusable starting point
);
```

> **Templates:** A curriculum with `status = 'template'` has no children assigned and generates no lessons. It is a blueprint only. Applying a template creates a new `draft` curriculum copying all `curriculum_subjects` rows. Platform curricula are seeded with `family_id = NULL` and `status = 'template'`.

**Platform period defaults:**

| period_type | Suggested duration |
|---|---|
| monthly | 4 weeks |
| quarterly | 13 weeks |
| semester | 18 weeks |
| annual | 36 weeks |

---

### 2.4 Child–Curriculum (Junction)

A curriculum can be shared by multiple children (e.g. twins). Each child may only have **one active curriculum** at a time.

```sql
CREATE TABLE child_curriculums (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  curriculum_id   UUID NOT NULL REFERENCES curriculums(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (child_id, curriculum_id)
);
```

**Enforcement:** Before inserting a row that would give a child a second `active` curriculum, the API must reject with `409 Conflict`. The client prompts the parent to resolve the existing active curriculum first.

---

### 2.5 Curriculum Subject

Describes how a Subject is taught within a specific Curriculum, with all per-curriculum schedule overrides.

```sql
CREATE TABLE curriculum_subjects (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id               UUID NOT NULL REFERENCES curriculums(id) ON DELETE CASCADE,
  subject_id                  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,

  -- Schedule (overrides subject defaults)
  weekly_frequency            SMALLINT NOT NULL DEFAULT 5,       -- 1-7
  session_duration_minutes    SMALLINT NOT NULL DEFAULT 45,      -- 5-480
  scheduled_days              SMALLINT[],
  -- 0=Mon ... 6=Sun. If empty, system distributes evenly across family school days.
  -- When provided, array length must equal weekly_frequency.

  -- Time of day preference
  preferred_time_slot         time_slot_preference DEFAULT 'flexible',

  -- Scope
  goals_for_period            TEXT[],

  -- Co-op linkage
  coop_group_id               UUID REFERENCES coop_groups(id) ON DELETE SET NULL,

  -- Display
  sort_order                  SMALLINT DEFAULT 0,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,

  notes                       TEXT,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (curriculum_id, subject_id)
);

CREATE TYPE time_slot_preference AS ENUM (
  'morning_first',
  'morning',
  'midday',
  'afternoon',
  'flexible'
);
```

---

### 2.6 Platform-Provided Curricula

Oikos seeds a set of ready-made curriculum templates (`family_id = NULL`, `status = 'template'`) for different ages and philosophies. Parents apply one as a starting point and customise freely.

**Seed curriculum templates:**

| Name | Philosophy | Age range | Period |
|---|---|---|---|
| Early Years Foundation | Relaxed / Play-based | 3–5 | Annual |
| Classical Grammar Stage – Primary | Classical | 6–9 | Annual |
| Classical Grammar Stage – Upper | Classical | 10–12 | Annual |
| Classical Dialectic Stage | Classical | 10–12 | Annual |
| Classical Rhetoric Stage | Classical | 13–15 | Annual |
| Charlotte Mason – Early Years | Charlotte Mason | 5–8 | Annual |
| Charlotte Mason – Middle Years | Charlotte Mason | 9–12 | Annual |
| Structured Core – Elementary | Structured | 6–10 | Annual |
| Structured Core – Middle School | Structured | 11–13 | Annual |
| Eclectic – High School Prep | Eclectic | 13–16 | Annual |

Each template must have fully configured `curriculum_subjects` rows (subjects, weekly frequency, duration, scheduled days) so that applying it produces a usable plan immediately.

---

### 2.7 Key Relationships Summary

```
Subject (platform or family-owned)
  └── referenced in many curriculum_subjects rows

Child
  └── child_curriculums[] ──► Curriculum (one active at a time; many historical)

Curriculum (family-owned or platform template)
  ├── child_curriculums[] ──► Child (one or more)
  ├── curriculum_subjects[]
  │     ├── subject_id       ──► Subject
  │     ├── scheduled_days[] ──► drives Lesson generation and Calendar
  │     └── coop_group_id    ──► CoopGroup (optional)
  └── status: draft | active | paused | completed | archived | template

Lesson (generated from CurriculumSubject x assigned children)
  ├── curriculum_subject_id  ──► CurriculumSubject
  ├── child_id               ──► Child
  └── scheduled_date
```

---

## 3. Business Logic

### 3.1 Subject Rules

- Platform subjects (`is_platform_subject = TRUE`) are **read-only**. Families fork one to create an editable copy (`family_id` set to the family, `is_platform_subject = FALSE`).
- A Subject with `is_public = TRUE` is visible in the community Subject Library.
- Deleting a Subject referenced by any `curriculum_subjects` row must be **blocked** (`409 Conflict`). The parent must remove it from those curricula first, or archive it instead.
- Archiving hides the subject from pickers but preserves all historical data.

### 3.2 Curriculum Rules

- **One active curriculum per child.** The API rejects any `child_curriculums` insert that would give a child a second `active` curriculum. The client prompts the parent to resolve the conflict.
- A `template` curriculum has no children assigned and generates no lessons.
- Lessons are generated only when a curriculum transitions `draft` → `active`. If `scheduled_days` is empty on a `curriculum_subjects` row, sessions are distributed evenly across the family's school days (Mon–Fri by default).
- When transitioning to `completed`, all future unstarted lessons are set to `skipped` unless the parent opts out.
- Deleting a curriculum is only permitted when `status = 'draft'` or `'template'`.
- **Saving as template:** Sets `status = 'template'` and removes all `child_curriculums` rows. The curriculum disappears from all child plans.
- **Applying a template:** Creates a new `draft` curriculum for the family, copying all `curriculum_subjects` rows. The parent then assigns children and activates.

### 3.3 Curriculum Subject Rules

- `weekly_frequency`: 1–7. `session_duration_minutes`: 5–480.
- If `scheduled_days` is provided, its length must equal `weekly_frequency`.
- `sort_order` controls display order. Parents reorder via drag-and-drop (keyboard alternative required).
- `is_active = FALSE` pauses that subject only — no new lessons generated, existing incomplete lessons skipped.
- Adding a subject to an already-active curriculum prompts whether to generate lessons for the remaining period.

---

## 4. UI Specification

- Rename the UI elements from "Disciplines" to "Subjects" and make it to navigate to Subjects area.
- Create a sidebar menu item to "Curriculums"

### 4.1 Principles

- **Clarity over density.** Every screen must feel approachable to non-technical parents.
- **Colour and icon are first-class.** Subjects always render with their assigned colour and icon — in lists, pickers, calendar blocks, and progress cards.
- **Progressive disclosure.** Show essentials first; advanced config is expandable.
- **Guard against overwhelm.** Warn when planned weekly hours may be excessive for the child's age.
- Empty states must include an illustration, a headline, and a clear call-to-action.
- Toasts (auto-dismiss 4 s) for all create/save/archive/delete actions.
- All drag-and-drop must have an accessible keyboard alternative.

---

### 4.2 Subject Library

Browse all subjects available to the family: their own, platform-provided, and community-shared.

**Filters:** text search, source (My Subjects / Platform / Community), category, age range.

**Subject card:** colour swatch, icon, name, category badge, short description, "Used in N curricula". Platform subjects carry an "Oikos" badge; community subjects carry the family's shield.

**Actions:** `+ New Subject` top-right. Platform subjects offer `Fork & Customise` instead of Edit.

---

### 4.3 Subject Form (Create / Edit)

Single-page form. Auto-saves draft every 30 s.

**Fields:** Name (required) · Short Description · Long Description (markdown) · Category (icon-button group, required) · Colour (12-swatch palette + custom hex) · Icon (searchable grid) · Min/Max Age · Min/Max Grade Level *(informational only)* · Default sessions/week (stepper 1–7) · Default session duration (5-min steps) · Learning Objectives (repeating list, drag to reorder) · Skills Targeted (free-tag chips) · Prerequisites (subject picker) · Visibility (Private / Share with Community).

Deletion is blocked if the subject is in use — show which curricula reference it, offer Archive instead.

---

### 4.4 Curriculum List (Child View)

Reachable from the child's profile. Groups curricula by status: **Active** (highlighted, weeks-elapsed progress bar) → **Draft** ("Finish planning" CTA) → **Completed** (collapsible) → **Archived** (collapsed) → **Templates** (family-saved blueprints).

`+ New Curriculum` opens the creation wizard.

---

### 4.5 Create Curriculum — Wizard (4 Steps)

Progress indicator at top. Data saved as draft between steps.

**Step 1 — Plan Details**
- Name (e.g. "Year 4 · 2025–2026"), Academic Year, Term Name.
- Period Type: visual card group (Monthly / Quarterly / Semester / Annual / Custom). Non-custom auto-calculates end date from start date (editable). Show total school weeks.
- Education Philosophy (pre-filled from family profile; overridable).
- Overall Goals (optional).
- **Start from a template:** secondary button opens the Template Browser (§4.8) filtered by age and philosophy. Selecting a template pre-fills Steps 1–3.

**Step 2 — Assign Children**
- Checkbox list of the family's children. Each selected child shows their current active curriculum (if any) with a warning that it must be resolved before activation.

**Step 3 — Choose & Configure Subjects**
- Left panel: Subject search/filter (compact Subject Library).
- Right panel: selected subjects tray (drag to reorder; shows estimated total weekly hours).
- Weekly hours indicator colour-coded by child age: green = healthy · amber = review recommended · red = warning.
- Each subject has an expandable config card: Sessions/week · Session duration · Scheduled days (day toggles; selections must equal weekly_frequency) · Preferred time slot · Goals for period · Co-op toggle → CoopGroup selector · Notes.
- `Apply same schedule to all subjects` shortcut for uniform Mon–Fri plans.

**Step 4 — Review & Activate**
- Summary table: Subject | Sessions/wk | Duration | Days | Weekly hours.
- Total weekly hours bar (colour-coded).
- `Save as Draft` (secondary) — no lessons generated.
- `Activate Curriculum` (primary) — triggers background lesson generation; navigates to dashboard.
- If any assigned child already has an active curriculum: modal to resolve (Archive / Mark Complete / Keep — last option shown with a warning).

---

### 4.6 Curriculum Dashboard

**Header:** name, children avatars, date range, period badge, status badge, weeks-elapsed progress bar.
**Action menu:** Edit · Pause · Complete · Archive · Save as Template.

**Tabs:**
- **Overview** — overall goals; per-subject summary card (colour, icon, sessions this week, all-time completion %).
- **Subjects** — full list, drag-to-reorder; add/pause/remove individual subjects.
- **Schedule** — weekly grid, subjects colour-coded by subject. Drag blocks between days to update `scheduled_days`. Toggle "Typical week" vs "This week" (actual lessons + completion status).
- **Progress** — per-subject completion rates; attendance heatmap (green = all done · amber = partial · grey = not started · red = skipped).

---

### 4.7 Edit Curriculum

Same layout as the wizard but as a single page. Changes to `scheduled_days` or `weekly_frequency` prompt: *"Regenerate future lessons for this subject?"* → `Regenerate` · `Keep existing`.

---

### 4.8 Template Browser

Modal or side-drawer with two sections:

- **Platform Templates** — grouped by age range, filterable by philosophy. Read-only; `Apply` button only.
- **My Templates** — family-saved curricula with `status = 'template'`. `Apply` or `Delete`.

Each card shows: name, philosophy badge, age range, period type, subject list. `Apply Template` creates a new `draft` curriculum copying all subjects and configuration.

`Save as Template` (from curriculum action menu) sets `status = 'template'`, removes all child assignments, and moves the curriculum to My Templates.

---

### 4.9 Confirmation Modals

| Action | Key message | Primary CTA |
|---|---|---|
| Delete Subject (in use) | "Used in N curricula — remove it first, or archive instead." | Archive Subject |
| Archive Subject | "Hidden from pickers; history preserved. Unarchivable any time." | Archive |
| Delete Curriculum (draft/template only) | "This cannot be undone." | Delete |
| Complete Curriculum | "N future lessons will be marked as skipped." | Mark Complete |
| Save as Template | "Removed from all children and saved as a template." | Save as Template |
| Activate with conflict | "Resolve [child]'s existing active curriculum first." | Archive / Complete / Keep |

---

## 5. Out of Scope for This Spec

The following are explicitly deferred to separate specs:

- **Resources** — `resources` table and library. Foreign key slots exist but the model is not defined here.
- **Lessons** — individual lesson records, completion UI, journal entries. Lesson generation is triggered here but the Lesson feature is defined separately.
- **Weekly Schedule Detail** — fine-grained time-of-day scheduling (`curriculum_subjects_weekly` table) is a future spec.
- **Topics / Syllabus Tracker** — per-subject topic lists and progress cursors within a curriculum are deferred.
- **Assessment / Quiz Builder** — deferred.
- **Calendar / Planner** — week-view and day-view calendar UI is a separate feature.
- **AI Assistant** — curriculum and subject data will be passed as context but the assistant is a separate spec.
- **Co-op Groups** — `coop_group_id` is referenced but the CoopGroup feature is separate.
- **Progress Reporting / PDF Export** — separate spec.

---

*Spec version: 1.1 · Oikos Project · Last updated: 2026*
