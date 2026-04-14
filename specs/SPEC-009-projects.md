# SPEC-009 — Projects

**Platform:** Oikos  
**Status:** Draft  
**Depends on:** SPEC-001 (Auth), SPEC-002 (Family & Children), SPEC-004 (Subjects & Curricula)

> **Cross-spec data model note:** This spec requires a `coat_of_arms_url TEXT` column on the `families` table (introduced in SPEC-002). The column is nullable; the certificate renders without a coat of arms if not set. Population of this field is deferred to the file upload feature.

---

## 1. Overview

A **Project** is a structured assignment given to one or more children to apply knowledge and skills learned across one or two Subjects. Projects embody the conviction that learning is not merely for accumulation but for exercise — that knowledge finds its fullest expression in doing, making, and serving others.

Every project has a defined purpose, a due date, a sequence of milestones, and culminates in a portfolio entry that becomes part of the child's permanent record of learning.

---

## 2. Data Model

### 2.1 `projects`

The top-level project record, owned by the family.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `family_id` | UUID | FK → `families.id`, NOT NULL | |
| `title` | VARCHAR(200) | NOT NULL | |
| `description` | TEXT | | What the project is and why it matters |
| `purpose` | TEXT | | Explicit statement of who benefits or what is served — the "for others" dimension |
| `due_date` | DATE | | Optional but strongly encouraged |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT `'active'` | Enum: `draft`, `active`, `complete`, `archived` |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `archived_at` | TIMESTAMPTZ | | Soft deletion timestamp |
| `completed_at` | TIMESTAMPTZ | | Set when status transitions to `complete` |

**Indexes:** `family_id`, `status`, `due_date`

---

### 2.2 `project_children`

Associates one or more children with a project. A project must have at least one child and at most the total number of children in the family (no hard platform cap, but UX nudges toward meaningful group sizes).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `project_id` | UUID | FK → `projects.id`, NOT NULL | |
| `child_id` | UUID | FK → `children.id`, NOT NULL | |
| `assigned_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Primary key:** `(project_id, child_id)`

---

### 2.3 `project_subjects`

Associates zero, one, or two Subjects with a project. Subjects are optional — projects may be free-form with no subject link. The cap of two subjects is enforced at the application layer (not via DB constraint).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `project_id` | UUID | FK → `projects.id`, NOT NULL | |
| `subject_id` | UUID | FK → `subjects.id`, NOT NULL | |
| `is_primary` | BOOLEAN | NOT NULL, DEFAULT `true` | First subject is primary; second (if any) is supporting |

**Primary key:** `(project_id, subject_id)`

---

### 2.4 `project_milestones`

Ordered checkpoints within a project. Milestones represent meaningful phases of work — not arbitrary tasks.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `project_id` | UUID | FK → `projects.id`, NOT NULL | |
| `title` | VARCHAR(200) | NOT NULL | |
| `description` | TEXT | | What to do / what good looks like |
| `sort_order` | INTEGER | NOT NULL | Controls display order; completion is not required to follow this order |
| `due_date` | DATE | | Optional per-milestone due date |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Default milestone scaffold** (applied when creating a project, all optional/editable):

1. Research & Gather
2. Plan & Outline
3. Create & Build
4. Review & Refine
5. Present or Deliver
6. Reflect

---

### 2.5 `milestone_completions`

Tracks which child completed which milestone and when. A milestone can be completed independently by each assigned child (important for group projects where children may work at different paces).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `milestone_id` | UUID | FK → `project_milestones.id`, NOT NULL | |
| `child_id` | UUID | FK → `children.id`, NOT NULL | |
| `completed_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `notes` | TEXT | | Brief note from parent about this child's completion |

**Unique constraint:** `(milestone_id, child_id)` — one completion record per child per milestone

---

### 2.6 `project_resources`

Links existing platform resources to a project. Resources are not duplicated — this is a junction to the `resources` table from SPEC-005.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `project_id` | UUID | FK → `projects.id`, NOT NULL | |
| `resource_id` | UUID | FK → `resources.id`, NOT NULL | |
| `added_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `notes` | TEXT | | Context for why this resource is linked |

**Primary key:** `(project_id, resource_id)`

---

### 2.7 `portfolio_entries`

A portfolio entry is created per child when a project is marked complete. It represents the child's individual output — their evidence of learning — and becomes part of their permanent academic record.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `project_id` | UUID | FK → `projects.id`, NOT NULL | |
| `child_id` | UUID | FK → `children.id`, NOT NULL | |
| `title` | VARCHAR(200) | NOT NULL | Defaults to project title; parent may customise |
| `reflection` | TEXT | | The child's or parent's reflection on the work |
| `parent_notes` | TEXT | | Assessor/parent evaluation notes |
| `score` | SMALLINT | CHECK (`score` BETWEEN 1 AND 10) | Optional holistic score assigned by the parent; 1 = needs significant growth, 10 = exceptional work |
| `media_urls` | TEXT[] | DEFAULT `'{}'` | Deferred to file upload feature; stored as URL strings |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Unique constraint:** `(project_id, child_id)` — one portfolio entry per child per project

**Index:** `child_id` (portfolio entries will be fetched frequently by child)

---

### 2.8 `child_achievements`

An achievement is awarded per child when a project is marked complete. It anchors the badge displayed in the UI and the data needed to render the printable certificate.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `child_id` | UUID | FK → `children.id`, NOT NULL | |
| `project_id` | UUID | FK → `projects.id`, NOT NULL | |
| `awarded_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Timestamp of project completion |
| `certificate_number` | VARCHAR(20) | NOT NULL | Human-readable identifier, e.g. `OIK-2024-0001`; unique per family, sequential |
| `acknowledged_at` | TIMESTAMPTZ | | Set when the parent reveals the achievement to the child ("moment of celebration") |

**Unique constraint:** `(project_id, child_id)` — one achievement per child per project

**Index:** `child_id`

**`certificate_number` generation:** formatted as `OIK-{YYYY}-{NNNN}` where `NNNN` is a zero-padded integer incrementing per family. Computed at the API layer on award creation; stored for stability (the number must not change if regenerated).

---

## 3. Business Logic

### 3.1 Subject Cap

Subjects are **optional**. A project may be free-form (no subject linked) or linked to **up to 2 Subjects**. This ceiling is enforced at the API layer. Attempts to add a third subject return a validation error.

### 3.2 Project Completion

A project transitions to `complete` status when the parent explicitly marks it so. The platform does **not** auto-complete based on milestone state. On completion:

- `projects.completed_at` is set to the current timestamp
- `projects.status` is set to `complete`
- A `portfolio_entry` is created for **each child** assigned to the project (if one does not already exist)
- A `child_achievement` record is created for **each child** assigned to the project (if one does not already exist), awarding the project completion badge and generating a printable certificate

### 3.3 Milestone Completion

Milestones may be completed **in any order** and **independently per child**. There is no enforced sequencing. A parent marks a milestone complete for a specific child. The completion can be undone.

### 3.4 Project Archiving

Projects are soft-deleted via `archived_at`. Archived projects are hidden from active views but remain accessible in archived/historical views. Portfolio entries from archived projects are preserved.

### 3.5 Child Assignment Integrity

If a child is removed from a project:
- Their `milestone_completions` records are preserved
- Their `portfolio_entry` (if already created) is preserved
- They are removed from `project_children`

### 3.6 Progress Calculation

**Project-level progress** (per child) is computed at runtime as:

```
milestones_completed_by_child / total_milestones_in_project
```

No progress column is stored on the project record itself.

### 3.7 Overdue Detection

A project is considered **overdue** if `due_date < today` and `status` is `active` or `draft`. Computed at runtime, not stored.

---

## 4. UX Flows

### 4.1 Project List (`/projects`)

- Displays all active and draft projects for the family, sorted by `due_date ASC` (nulls last)
- Each project card shows: title, assigned children (initials), linked subjects, due date, per-child milestone progress bars, overdue badge (if applicable)
- Filtering: by child, by subject, by status
- Quick actions: Mark Complete, Archive
- Empty state includes a warm call-to-action: *"Projects turn learning into living. Create your first one."*

### 4.2 Create Project (`/projects/new`)

A focused creation flow. Fields:

1. **Title** — required
2. **Assign children** — multi-select from family's children; at least one required
3. **Link subjects** — optional; select up to 2 from the family's subjects. A project may have no subject link (free-form).
4. **Due date** — optional date picker
5. **Description** — optional; what is this project?
6. **Purpose** — optional but prompted with placeholder copy: *"Who will benefit from this work? What is it for?"*
7. **Milestones** — pre-populated with the default scaffold; parent may edit titles, reorder, add, or delete before saving

On save, the project is created in `draft` status by default. Parent is taken to the project detail page.

### 4.3 Project Detail (`/projects/[project_id]`)

Sections:

**Header**
- Title, status badge, due date (with overdue styling if applicable)
- Assigned children (initials with names)
- Linked subjects (tag pills)
- Actions: Edit, Mark Complete, Archive

**Overview tab**
- Description and Purpose fields (inline editable)
- Per-child overall progress (milestone completion bar)

**Milestones tab**
- List of milestones in `sort_order`
- Each milestone row shows: title, description, due date (if set), and per-child completion toggles
- Parent can toggle completion for each child independently
- Milestones can be reordered via drag-and-drop
- "Add milestone" inline at bottom of list

**Resources tab**
- Cards for linked resources (title, type, URL)
- "Link resource" opens a search/select drawer over the existing resource library
- Resources can have a context note specific to this project

**Portfolio tab**
- Shows portfolio entries for each assigned child
- Entry fields: Title (editable), Reflection, Parent Notes, Score (1–10 selector, optional), Media (deferred — placeholder UI)
- The score selector uses a simple 1–10 scale with brief anchoring labels at the extremes: *"Needs growth"* at 1 and *"Exceptional"* at 10; no label is shown for intermediate values
- If no score is set, the field displays as unscored rather than defaulting to any value

### 4.4 Edit Project

Opens a drawer with all fields from the creation flow, pre-populated. Subject changes respect the 0–2 subject cap.

### 4.5 Mark Complete Flow

Clicking "Mark Complete" opens a confirmation modal:
- Confirms project title
- Warns if any milestones remain incomplete (lists them; does not block completion)
- Confirms that portfolio entries and achievement badges will be created for each assigned child
- CTA: *"Complete Project"*

On confirm:
- Project transitions to `complete`
- Portfolio entries are created for each child
- Achievement badges are awarded to each child
- The parent is shown a celebration moment (see §4.7) before returning to the project detail page

### 4.6 Portfolio Access

Portfolio entries are surfaced both on the Project detail page and on the child's profile (per SPEC-007). The portfolio view on a child's profile shows all entries across all projects, sorted by `created_at DESC`.

### 4.7 Achievement Badge & Celebration Moment

Immediately after project completion is confirmed, the UI transitions to a full-screen celebration overlay (not a toast — this is a moment). For each child assigned to the project:

- A **badge** is revealed with a brief animation (e.g. a stamp or seal appearing)
- The badge displays: the child's initials (styled prominently), the project title, and the completion date
- A secondary line shows linked subjects, if any
- The parent may tap **"Show [Child's Name]"** to use this screen as the reveal moment with their child present

Badge visual language: a circular seal shape using the Oikos forest-green palette, with a laurel or ribbon motif. Each project completion badge is identical in shape and colour — the distinction is the child's name and project title inside. Badge design is intentionally timeless rather than playful (appropriate for framing).

After dismissing the celebration overlay, the project detail page reflects `complete` status.

**Badge surfacing elsewhere:**
- Child profile page: a row of earned badge seals, sorted by `awarded_at DESC`
- Hovering / tapping a badge shows the project title and completion date
- Badge count is displayed in the child profile header

### 4.8 Printable Certificate

Each `child_achievement` has a corresponding certificate, accessible at:

```
/projects/[project_id]/certificate/[child_id]
```

The certificate is a **print-optimised page** (print CSS, A4 / US Letter). It is not a generated PDF — the browser's native print dialog is used. The page should render beautifully at 96dpi screen and 300dpi print.

**Certificate layout and content:**

```
┌─────────────────────────────────────────────────────┐
│  [decorative border — double-rule, corner ornaments] │
│                                                      │
│   [ Family Coat of Arms ]   [ Oikos wordmark/seal ]  │
│      (left, ~60×80px)           (right, ~60×80px)    │
│                                                      │
│         Certificate of Project Completion            │
│                                                      │
│                 This certifies that                  │
│                                                      │
│              [ Child's Full Name ]                   │
│           (large, serif, Palatino Linotype)          │
│                                                      │
│             has faithfully completed the             │
│                                                      │
│              [ Project Title ]                       │
│           (medium, serif, slightly smaller)          │
│                                                      │
│  [ Subject(s), if any — italic tag line ]            │
│  e.g. "in the study of Mathematics & Latin"          │
│                                                      │
│  [ Purpose, if set — quoted, smaller ]               │
│  e.g. "for the benefit of the local community"       │
│                                                      │
│        Completed on [ Month DD, YYYY ]               │
│                                                      │
│    [ Family Name ]            Certificate No.        │
│                               OIK-2024-0001          │
│                                                      │
│    ___________________    ___________________        │
│    Parent / Educator       Date                      │
│                                                      │
│  [decorative footer rule]                            │
└─────────────────────────────────────────────────────┘
```

**Coat of arms placement:** displayed top-left, paired with the Oikos seal top-right — the two seals flank the certificate title symmetrically. If no coat of arms has been uploaded by the family, the Oikos seal is centred alone at the top (the layout reflows; there is no placeholder or blank space).

**Design notes:**
- Palette: forest green (#1A3828) for rules, ornaments, and wordmark; black for body text; parchment/ivory page background (`#FAF7F0`)
- Typography: Palatino Linotype (or Georgia as fallback) for all text — no sans-serif on the certificate
- Decorative border: thin double-rule in forest green with simple corner ornaments (SVG inline, no external images)
- Oikos seal: the house-with-open-book icon
- **Family coat of arms:** rendered from `families.coat_of_arms_url` as an `<img>` tag; accepted formats are PNG, JPG, and SVG. Displayed at a fixed print size of approximately 2.5cm × 3.5cm (portrait orientation, typical heraldic proportions). The image is rendered with `object-fit: contain` so no cropping or distortion occurs regardless of the uploaded aspect ratio. No border or frame is added — the image stands alone as a seal.
- Signature lines are printed blank — intended for physical signing after printing
- No QR codes, no URLs, no digital verification marks — this is a physical document for a family

**Print behaviour:**
- `@media print`: hide browser chrome, navigation, and any action buttons
- The certificate page has a single action button (screen-only): **"Print Certificate"** → triggers `window.print()`
- Paper size defaults to A4; US Letter also renders correctly without clipping

**Access:**
- Certificate link is available on the Project detail → Portfolio tab, alongside each child's portfolio entry
- Certificate link is also available on the child's profile badge row (tap badge → modal with "View Certificate" CTA)

---

Projects are accessible from the global navigation shell under **Education → Projects**.

The per-child profile page (SPEC-007) includes a **Portfolio** summary panel linking to `/projects?child=[child_id]&status=complete`.

---

## 6. Out of Scope / Deferred

| Item | Notes |
|---|---|
| File uploads for portfolio media | Deferred until file/storage service is integrated; `media_urls` column is reserved |
| Family coat of arms upload | `families.coat_of_arms_url` column is reserved; upload UI deferred to the file upload feature. Certificate renders without it until then. |
| Parent-to-child assignment (child-facing view) | Child-facing interface not yet designed |
| Project templates | Platform-provided project scaffolds (e.g., "Nature Study", "Book Report", "Community Service") are a Phase 2 item |
| Rubric / grading | Assessment and rubric builder is a separate spec |
| Co-op projects (cross-family) | Community feature; deferred to Phase 4 |
| Notifications / reminders for due dates | Notification system not yet designed |
| Comments / discussion thread per project | Deferred |

---

## 7. Open Questions

1. **Should portfolio entries be created eagerly (on project completion) or lazily (on first access)?** Current spec says eagerly; this ensures entries exist even if parent never visits the portfolio tab.

2. **Should milestones be shared across children or per-child?** Current model has one set of milestones per project, with per-child completion records. An alternative would be fully independent milestone lists per child — rejected for now as too complex for the core use case.

3. **Should a project require at least one subject, or can free-form projects exist?** **Resolved:** subjects are optional. A project may exist with no subject link. This allows families to assign projects that are inherently cross-disciplinary or practical-life in nature (e.g., "Plan the family garden", "Cook a meal for a neighbour") without forcing an artificial subject categorisation.

4. **What happens to portfolio entries if a project is un-completed (reverted to active)?** Not addressed in current spec — likely leave entries intact but display them as "in progress."

5. **Is there a meaningful distinction between "archived" and "deleted"?** All current specs use soft archiving; this pattern is maintained here.