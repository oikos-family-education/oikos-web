# SPEC-011 — Progress

**Platform:** Oikos — Open Source Family Education Platform
**Version:** 1.0
**Status:** Ready for implementation
**Depends on:** SPEC-002 (Family & Children), SPEC-004 (Subjects & Curricula), SPEC-005 (Week Planner), SPEC-009 (Projects)

---

## 1. Overview

The **Progress** page is the parent's feedback loop. It turns the daily discipline of teaching into something visible — a log they can see, a streak they can protect, and a printable record they can hand to a reviewer, a grandparent, or a regulator.

It has two complementary surfaces:

1. **Teaching log** — a lightweight daily check-in where the parent marks that they taught today, optionally broken down by subject and/or child. This generates the **streak** (consecutive days of teaching) both overall and per subject/child.
2. **Progress report** — a full summary of the family's education: active curricula, the subjects within them, project milestones completed, and teach counts aggregated by child and by subject over a chosen date range. The report is printable and carries the **Oikos logo** and the **family coat of arms** so it reads as a formal document.

This spec does **not** introduce assessment grading, standardized-test tracking, or AI-generated narrative reports — those are out of scope for v1.

---

## 2. Core Concepts

| Term | Definition |
|---|---|
| **Teaching log entry** | A single dated record that the parent taught. Scope: all children or one child; all subjects or one subject. Multiple entries per day are allowed as long as `(date, child_id, subject_id)` is unique. |
| **Streak** | The count of consecutive **ISO weeks** (ending this week or last week) in which the scope's **expected weekly sessions** were met. Weekly frequency is read from `curriculum_subjects.weekly_frequency` when the subject is in an active curriculum, falling back to `subjects.default_weekly_frequency`. A streak is not about every calendar day — it's about meeting the cadence the parent planned. Three scopes: per subject, per child, overall family. |
| **Weekly target** | The number of sessions per week expected in a given scope. For a subject: its `weekly_frequency`. For a child: the sum of `weekly_frequency` across the subjects in their active curriculum. For the whole family: the sum across all children's active-curriculum subjects. |
| **Teach count** | The total number of teaching log entries within a date range, filtered by scope (overall / subject / child / subject × child). |
| **Progress report** | A rendered, printable view that combines curricula, subjects, project milestones, and teach counts for a date range. |
| **Scope selector** | The UI control that picks *whose* progress is being viewed: the whole family, a specific child, a specific subject, or a subject-for-a-child pair. |

---

## 3. Data Model

### 3.1 `teaching_logs`

A single table backs the teaching log. It is intentionally denormalized: the parent can log *"I taught today"* (no child, no subject), *"I taught Latin today"* (subject only), *"I taught Maya today"* (child only), or *"I taught Latin to Maya today"* (both).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `family_id` | UUID | FK → `families.id` ON DELETE CASCADE, NOT NULL, INDEX | |
| `taught_on` | DATE | NOT NULL, INDEX | Local date in the family's timezone (see §3.4). |
| `child_id` | UUID | FK → `children.id` ON DELETE CASCADE, NULLABLE | `NULL` = all children. |
| `subject_id` | UUID | FK → `subjects.id` ON DELETE SET NULL, NULLABLE | `NULL` = general teaching, no subject breakdown. |
| `minutes` | SMALLINT | NULLABLE, CHECK (`minutes IS NULL OR (minutes > 0 AND minutes <= 720)`) | Optional; 12-hour cap. |
| `notes` | VARCHAR(500) | NULLABLE | Free-text note, shown on hover in the calendar heatmap and on the printable report. |
| `logged_by_user_id` | UUID | FK → `users.id`, NOT NULL | Parent who recorded the entry. |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()` | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT `now()`, ON UPDATE `now()` | |

**Uniqueness:**

```
UNIQUE (family_id, taught_on, COALESCE(child_id, '00000000-0000-0000-0000-000000000000'::uuid),
                              COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid))
```

Enforced as a partial unique index using the `COALESCE` trick so `NULL` child/subject counts as "all". This prevents accidental double-logs while still allowing one entry per (date, child, subject) combination.

**Indexes:**
- `(family_id, taught_on DESC)` — the primary list query.
- `(family_id, child_id, taught_on DESC)` — per-child streak calc.
- `(family_id, subject_id, taught_on DESC)` — per-subject streak calc.

### 3.2 No new project tables

Project milestone completions are already stored in `milestone_completions` (SPEC-009). The report reads from there directly.

### 3.3 No new curriculum tables

Curriculum and curriculum-subject data is already in `curriculums` / `curriculum_subjects` / `child_curriculums` (SPEC-004). The report reads from there directly.

### 3.4 Timezone handling

`taught_on` is a `DATE`, not a timestamp. The frontend converts "today" into a local ISO date (`YYYY-MM-DD`) using the browser's timezone and sends it with every POST. The backend trusts it. A later spec can introduce a stored `family.timezone` if multi-device drift becomes a real problem — not a v1 concern.

---

## 4. API

All routes mounted at `/api/v1/progress`.

### 4.1 Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/progress/logs` | Create a teaching log entry for the authenticated user's family. |
| `GET`  | `/progress/logs` | List teaching log entries for a date range, filterable by child/subject. |
| `PATCH`| `/progress/logs/{id}` | Edit `minutes` or `notes` on an existing entry. Scope fields are immutable — delete and recreate. |
| `DELETE`| `/progress/logs/{id}` | Remove an entry. |
| `GET`  | `/progress/summary` | Aggregated dashboard payload: streaks, teach counts, calendar heatmap. |
| `GET`  | `/progress/report` | Full report payload for the printable view (see §4.4). |

### 4.2 `POST /progress/logs`

**Request:**

```json
{
  "taught_on": "2026-04-21",
  "child_id": "uuid | null",
  "subject_id": "uuid | null",
  "minutes": 45,
  "notes": "Worked through chapter 3 together."
}
```

**Validation:**
- `taught_on` cannot be in the future.
- `taught_on` cannot be more than 365 days in the past (prevents accidental bulk backfills).
- `child_id`, if provided, must belong to the authenticated user's family.
- `subject_id`, if provided, must belong to the authenticated user's family **or** be a platform subject.
- Duplicate (per §3.1 unique index) → `409 Conflict`.

**Response:** `201 Created` with the full entry.

### 4.3 `GET /progress/summary`

Query params:

| Param | Type | Required | Notes |
|---|---|---|---|
| `from` | ISO date | No | Defaults to 90 days ago. |
| `to` | ISO date | No | Defaults to today. |
| `child_id` | UUID | No | Narrow all aggregates to one child. |

**Response shape:**

```json
{
  "range": { "from": "2026-01-21", "to": "2026-04-21" },
  "overall_streak": {
    "current_weeks": 6, "longest_weeks": 14,
    "weekly_target": 18, "this_week_count": 12,
    "last_met_week_start": "2026-04-13"
  },
  "per_child_streaks": [
    { "child_id": "uuid", "first_name": "Maya",
      "current_weeks": 4, "longest_weeks": 9,
      "weekly_target": 9, "this_week_count": 6 }
  ],
  "per_subject_streaks": [
    { "subject_id": "uuid", "name": "Latin", "color": "#6366F1",
      "current_weeks": 3, "longest_weeks": 8,
      "weekly_target": 4, "this_week_count": 3 }
  ],
  "teach_counts": {
    "total": 68,
    "by_child": [{ "child_id": "uuid", "first_name": "Maya", "count": 42 }],
    "by_subject": [{ "subject_id": "uuid", "name": "Latin", "count": 24 }]
  },
  "heatmap": [
    { "date": "2026-04-21", "count": 3 },
    { "date": "2026-04-20", "count": 2 }
  ]
}
```

**Streak definition:**
- Weeks are ISO weeks (Mon–Sun), computed in the family's local timezone.
- A week is **met** when the count of teaching log entries matching the scope, dated within that week, is ≥ `weekly_target` for that scope.
- `current_weeks` = count of consecutive met weeks ending at **this week or last week** (the current in-progress week counts as met only once its target is hit; the parent has until Sunday to meet it, so the streak doesn't break until a full week closes below target).
- `longest_weeks` = the longest run of met weeks over the family's lifetime, not just the range.
- `weekly_target` is recomputed live from the scope's current curriculum subjects — if the curriculum changes, historical weeks are **not** re-evaluated (the streak is prospective, not retroactive).
- `this_week_count` = entries matching the scope dated in the current ISO week; the UI uses this to render "3 of 4 this week" progress.
- If the scope has no `weekly_target` (no active curriculum assigns a frequency), `current_weeks` and `longest_weeks` are `null` and the UI shows a cadence-setup nudge instead of a streak number.

### 4.4 `GET /progress/report`

Query params:

| Param | Type | Required | Notes |
|---|---|---|---|
| `from` | ISO date | Yes | |
| `to` | ISO date | Yes | |
| `child_id` | UUID | No | If set, the report is narrowed to one child. |

**Response shape:**

```json
{
  "generated_at": "2026-04-21T14:05:00Z",
  "range": { "from": "2026-01-01", "to": "2026-04-21" },
  "family": {
    "family_name": "The Morais Family",
    "shield_config": { "...": "..." },
    "location": "Braga, Portugal"
  },
  "children": [
    { "id": "uuid", "first_name": "Maya", "grade_level": "4", "is_active": true }
  ],
  "curricula": [
    {
      "id": "uuid",
      "name": "Spring 2026",
      "period_type": "semester",
      "start_date": "2026-01-15",
      "end_date": "2026-06-15",
      "status": "active",
      "subjects": [
        { "subject_id": "uuid", "name": "Latin", "weekly_frequency": 4, "goals_for_period": ["…"] }
      ],
      "enrolled_child_ids": ["uuid"]
    }
  ],
  "projects": [
    {
      "id": "uuid",
      "title": "Build a bird feeder",
      "status": "active",
      "due_date": "2026-05-01",
      "child_ids": ["uuid"],
      "subject_ids": ["uuid"],
      "milestones": [
        { "id": "uuid", "title": "Design sketch", "due_date": "2026-04-10",
          "completions": [{ "child_id": "uuid", "completed_at": "2026-04-09T…" }] }
      ]
    }
  ],
  "teach_counts": {
    "range_days": 111,
    "days_with_any_log": 68,
    "total_entries": 142,
    "by_child": [
      {
        "child_id": "uuid",
        "first_name": "Maya",
        "total": 78,
        "by_subject": [{ "subject_id": "uuid", "name": "Latin", "count": 20 }]
      }
    ],
    "by_subject": [{ "subject_id": "uuid", "name": "Latin", "count": 44 }]
  }
}
```

The report endpoint is a single-shot fetch — the page renders the JSON directly, no follow-up calls. This keeps the printable view stable and reproducible.

---

## 5. Page Layout

Route: `apps/web/app/[locale]/(dashboard)/progress/page.tsx` (replaces the current placeholder).

### 5.1 Overall structure

```
┌──────────────────────────────────────────────────────────────────┐
│  HEADER: "Progress"                     [ Range: 90d ▾ ] [ 🖨 Report ] │
├──────────────────────────────────────────────────────────────────┤
│  TAB STRIP:  [ Log  ]  [ Streaks ]  [ Report ]                    │
├──────────────────────────────────────────────────────────────────┤
│  TAB CONTENT                                                      │
└──────────────────────────────────────────────────────────────────┘
```

The page is wrapped in `<div className="max-w-5xl">` per dashboard conventions.

### 5.2 Header

- **Title:** `text-2xl font-bold text-slate-800` — "Progress".
- **Range picker** (right): dropdown — *Last 30 days*, *Last 90 days* (default), *This term*, *This year*, *Custom…*. Persists to `localStorage` as `progress.range`.
- **Report button:** `<Button variant="secondary">` with `Printer` icon — navigates to `/progress/report` with the current range/scope preserved as query params.

### 5.3 Tab — Log (default)

Purpose: the daily check-in. It should feel like a one-second interaction.

```
┌─────────────────────────────────────────────────────────┐
│  Today, Tuesday Apr 21                                  │
│                                                         │
│  "Did you teach today?"                                 │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✓ Yes, I taught today                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Add detail (optional):                                 │
│  [ Child ▾ ]  [ Subject ▾ ]  [ 45 min ]  [ Note… ]     │
│  [ + Add entry ]                                        │
│                                                         │
│  Today's entries:                                       │
│   • Latin · Maya · 45m · "Chapter 3"              [x]   │
│   • General · all children                        [x]   │
└─────────────────────────────────────────────────────────┘
```

**Quick check-in (primary action):**
- Big primary `<Button>` labelled *"Yes, I taught today"* — one click writes a `{ taught_on: today, child_id: null, subject_id: null }` entry and shows a toast *"Nice — day logged."*
- Once today has any entry, the button flips to the green state: `✓ "You taught today"` and becomes disabled (but toggleable into *Add another*).

**Detailed entry form:**
- `Child` dropdown — defaults to *All children*.
- `Subject` dropdown — pulls from family subjects + platform subjects; defaults to *General*.
- `Minutes` input — optional, 12-hour cap.
- `Note` input — optional, 500 chars, shown on report.
- `Add entry` button saves via `POST /progress/logs`.

**Today's entries list:**
- Renders entries for `taught_on = today`.
- Each row: subject color dot, subject name (or "General"), child first name (or "All"), minutes, note truncated. An `x` button deletes (confirm inline).

**Backdating:**
- A small `"Log for a different day…"` link opens the same form with an editable date picker. Max 365 days in the past.

### 5.4 Tab — Streaks

Three cards stacked vertically, each a summary of one scope.

**5.4.1 Overall streak card**

```
┌──────────────────────────────────────────────────────┐
│  🔥  6-week streak                                   │
│      This week: 12 of 18 sessions                    │
│      ░░░░░░░░░░░░░░░▓▓▓▓▓                            │
│      Longest ever: 14 weeks                          │
└──────────────────────────────────────────────────────┘
```

- `🔥` icon uses `lucide-react` `Flame`, `w-10 h-10 text-primary`.
- Card style: `bg-white rounded-xl border border-slate-200 p-6`.
- The progress bar beneath the streak number visualizes `this_week_count / weekly_target`. It fills as the week progresses; reaching 100% is what keeps the streak alive.
- If the current week's target is met, the bar is `bg-primary`; if not yet met and the week is still open, it's `bg-primary/60`; if the previous week closed under target, the card switches icon to `CircleAlert`, bar to `bg-red-500`, and copy to *"Streak broken — meet this week's target to restart."*
- If `weekly_target` is `null` (no curriculum cadence set), show instead: *"Set a weekly cadence in your curriculum to start tracking streaks."* with a link to `/curriculums`.

**5.4.2 Per-child streaks**

One row per active child. Avatar, first name, `current_weeks` with flame, a thin inline progress bar for this week (`this_week_count / weekly_target`), and `longest_weeks` as faded subtitle. Clicking a row opens a drawer with that child's teach counts by subject and per-subject weekly targets.

**5.4.3 Per-subject streaks**

One row per subject with a `weekly_target > 0` via the active curriculum. Subject color swatch, name, `current_weeks`, inline progress `3 / 4 this week`, and `longest_weeks`. Clicking a row opens a drawer with that subject's teach counts by child and a mini sparkline of weekly target-met / target-missed over the range.

**5.4.4 Contribution heatmap (bottom of tab)**

- GitHub-style grid: columns = weeks, rows = Mon–Sun.
- Cell color intensity = count of entries that day (`bg-slate-100`, `bg-primary/30`, `bg-primary/60`, `bg-primary`).
- Hover tooltip: date + entry count + subject chips.
- Clicking a cell opens the entries for that date in a small popover with edit/delete.

### 5.5 Tab — Report

A compact, web-rendered preview of the printable report. Identical structure and data to §6 but laid out for screen reading, with section anchors and expandable curriculum/project sections. The `Printer` button in the header opens the dedicated printable route.

---

## 6. Printable Report

Route: `apps/web/app/[locale]/(dashboard)/progress/report/page.tsx`.

This is a standalone, full-width page optimized for paper. The dashboard chrome (sidebar, topbar) is **hidden** in print.

### 6.1 Layout

```
┌────────────────────────────────────────────────────────────┐
│   [Oikos logo]                               [Family shield]│
│                                                            │
│            Progress Report                                 │
│            The Morais Family                               │
│            January 1, 2026 — April 21, 2026                │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│                                                            │
│   Children                                                 │
│     • Maya (Grade 4)                                       │
│     • Tomás (Grade 2)                                      │
│                                                            │
│   Teaching Summary                                         │
│     • 68 of 111 days taught (61%)                          │
│     • 142 total entries                                    │
│                                                            │
│     Per child:                                             │
│       Maya   78 entries                                    │
│       Tomás  64 entries                                    │
│                                                            │
│     Per subject:                                           │
│       Latin       44                                       │
│       Math        38                                       │
│       Scripture   30                                       │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│                                                            │
│   Curricula                                                │
│     Spring 2026 Semester (2026-01-15 → 2026-06-15, active) │
│       Subjects:                                            │
│         • Latin — 4×/week — goals: …                       │
│         • Math — 5×/week — goals: …                        │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│                                                            │
│   Projects & Milestones                                    │
│     Build a bird feeder (Maya) — due 2026-05-01            │
│       ✓ Design sketch — 2026-04-09                         │
│       ☐ Cut pieces — due 2026-04-15                        │
│                                                            │
│  ─────────────────────────────────────────────────────────│
│   Generated on April 21, 2026 · Oikos                      │
└────────────────────────────────────────────────────────────┘
```

### 6.2 Header elements

- **Oikos logo**: inline SVG or `<img src="/oikos-logo.svg">` at `h-12`, left-aligned. If no logo asset exists, fall back to the text mark *"Oikos"* in `text-2xl font-bold tracking-tight text-slate-800` consistent with `apps/web/app/[locale]/onboarding/layout.tsx:16`.
- **Family coat of arms**: rendered via `<ShieldPreview config={family.shield_config} familyName={family.family_name} showMotto={true} width={120} height={140} />` — reuses the existing component from `apps/web/components/onboarding/ShieldPreview.tsx`. If `shield_config` is empty, render a muted placeholder shield outline so the layout stays balanced.
- **Report title**: `text-3xl font-bold text-slate-800`, centred beneath the header bar.
- **Family name + range**: `text-slate-600`, centred.

### 6.3 Print CSS

Add print rules to `globals.css` (scoped under a wrapper class, mirroring the certificate pattern in `apps/web/app/[locale]/(dashboard)/projects/[projectId]/certificate/[childId]/page.tsx:31`):

```css
@media print {
  body.printing-report > *:not(.progress-report-sheet) { display: none !important; }
  .progress-report-sheet { margin: 0; padding: 1.5cm; max-width: none; box-shadow: none; }
  .progress-report-sheet .page-break { break-before: page; }
  .progress-report-sheet a { color: inherit; text-decoration: none; }
}
@page { size: A4; margin: 0; }
```

### 6.4 Print interaction

- **Print button** (top-right, hidden in print via `print:hidden`): reuses the detach-and-print pattern from the certificate page — moves the report node to `<body>`, toggles `body.printing-report`, calls `window.print()`, restores the node on `afterprint`.
- Also supports *Save as PDF* via the native browser dialog — no server-side PDF generation in v1.

### 6.5 Content rules

- Section headings: `text-lg font-semibold text-slate-800` with a 1px `border-b border-slate-200` rule underneath.
- Tables of teach counts use `border-collapse` with thin slate borders and alternating row backgrounds.
- Completed milestones prefix with `✓`, incomplete with `☐`.
- If a section is empty ("no projects in range") render a muted italic line: *"No projects in this range."* — never omit the heading; reviewers expect the skeleton to match expectations.
- Long curriculum/project lists get `page-break` class every ~2 full pages to keep the paper layout readable.

---

## 7. Frontend State & Data Flow

- **Data fetching:** on mount, `ProgressPage` fetches `/progress/summary` with the active range. Switching tabs does not refetch unless the range changes.
- **Optimistic logging:** the "Yes, I taught today" quick button updates the streak cards optimistically and rolls back on error.
- **Invalidate-on-mutate:** any POST/PATCH/DELETE on `/progress/logs` triggers a refetch of `/progress/summary`.
- **No external state library.** Local `useState` + a small custom hook `useProgressSummary(range, childId)`.

---

## 8. Integration with Other Features

### 8.1 Dashboard

- Add a compact **"Teaching streak"** card to the home dashboard showing the overall current streak and a one-click *"Log today"* button that POSTs the general entry and refreshes. Card links to `/progress`.

### 8.2 Children page

- Each child card gains a small streak badge: `🔥 8` if the child has a current streak, or muted text if none.

### 8.3 Subject detail page

- If a subject has logs, a *"Taught X times in the last 90 days"* line appears on its detail card.

### 8.4 Week Planner

- When marking a week-planner session complete (if/when that feature exists), also create a `teaching_logs` entry automatically for `(today, planner.child_id, planner.subject_id)`, respecting the unique constraint. Out of scope for v1 if the planner doesn't yet surface a "complete" action — this is a future integration point, not a blocker.

---

## 9. Design & UX Details

### 9.1 Colors

- Streak flame / active numbers: `text-primary`.
- Broken streak: `text-red-500`.
- Heatmap intensity ramp: `bg-slate-100` → `bg-primary/30` → `bg-primary/60` → `bg-primary`.
- Subject dots use the subject's own `color` field.

### 9.2 Typography

- Follow `.claude/rules/design-system.md` conventions — no new font tokens.

### 9.3 Empty states

- **No logs yet:** *"No teaching logged yet. Hit the button above to start your streak."*
- **Report with no data in range:** *"Nothing to report in this range. Try widening the dates."*

### 9.4 Responsive

- Below `lg`, the tab strip becomes a horizontal scroll.
- The heatmap switches from full-year to trailing-12-weeks view on mobile.
- The printable report is always rendered at A4 width (no responsive reflow) — mobile users can still tap Print and their device will scale.

### 9.5 Accessibility

- Streak numbers announced with `aria-label` e.g. *"Current streak: 12 days, longest: 34 days."*
- Heatmap cells use buttons with `aria-label` including date and count.
- Print button has `aria-label="Print progress report"`.

---

## 10. i18n

Add a `Progress` namespace to `apps/web/messages/en.json`. Keys needed at minimum:

```json
"Progress": {
  "title": "Progress",
  "tabLog": "Log",
  "tabStreaks": "Streaks",
  "tabReport": "Report",
  "rangeLast30": "Last 30 days",
  "rangeLast90": "Last 90 days",
  "rangeThisTerm": "This term",
  "rangeThisYear": "This year",
  "rangeCustom": "Custom…",
  "printReport": "Print report",
  "didYouTeachToday": "Did you teach today?",
  "yesITaughtToday": "Yes, I taught today",
  "youTaughtToday": "You taught today",
  "logAnother": "Log another entry",
  "addDetailOptional": "Add detail (optional)",
  "child": "Child",
  "allChildren": "All children",
  "subject": "Subject",
  "generalTeaching": "General",
  "minutesPlaceholder": "Minutes",
  "notePlaceholder": "Note…",
  "addEntry": "Add entry",
  "todaysEntries": "Today's entries",
  "logForDifferentDay": "Log for a different day…",
  "overallStreak": "{count}-week streak",
  "longestEver": "Longest ever: {count} weeks",
  "thisWeekProgress": "This week: {count} of {target} sessions",
  "thisWeekInline": "{count} / {target} this week",
  "noCadenceYet": "Set a weekly cadence in your curriculum to start tracking streaks.",
  "streakBroken": "Streak broken — meet this week's target to restart.",
  "perChildStreaks": "Per child",
  "perSubjectStreaks": "Per subject",
  "heatmap": "Daily activity",
  "noLogsYet": "No teaching logged yet. Hit the button above to start your streak.",
  "confirmDeleteLog": "Delete this entry?",
  "dayLoggedToast": "Nice — day logged.",
  "duplicateLogError": "You already logged that combination for this day.",
  "reportTitle": "Progress Report",
  "reportGeneratedOn": "Generated on {date} · Oikos",
  "reportChildren": "Children",
  "reportTeachingSummary": "Teaching Summary",
  "reportDaysTaught": "{taught} of {total} days taught ({percent}%)",
  "reportTotalEntries": "{count} total entries",
  "reportPerChild": "Per child",
  "reportPerSubject": "Per subject",
  "reportCurricula": "Curricula",
  "reportProjects": "Projects & Milestones",
  "reportNoProjects": "No projects in this range.",
  "reportNoCurricula": "No curricula in this range.",
  "reportDueOn": "due {date}"
}
```

Also update `Placeholder.progressDesc` → remove (the placeholder is being replaced) and keep `Navigation.progress = "Progress"`.

---

## 11. Out of Scope (v1)

- AI-generated narrative summaries of progress.
- Assessment / test score tracking.
- Comparisons against curriculum or grade-level standards.
- Exporting to CSV/XLSX, or emailing the report.
- Server-side PDF generation (rely on browser *Save as PDF*).
- Reviewer/portfolio sharing links.
- Automatic teaching log creation from week planner sessions (waits for planner completion UX).
- Timezone-aware server side date handling (`taught_on` is trusted from the client).
- Reminders / notifications if a streak is about to break.
- Mobile-native "quick log" shortcut.

These are recorded as future possibilities, not deferrals with a commitment.

---

## 12. File Map (new files)

```
apps/api/
  app/models/teaching_log.py              TeachingLog ORM model
  app/schemas/progress.py                 Request + response Pydantic schemas
  app/services/progress_service.py        Business logic: log CRUD, streak calc, summary, report assembly
  app/routers/progress.py                 FastAPI router (mounted at /api/v1/progress)
  alembic/versions/XXXX_add_teaching_logs.py

apps/web/
  app/[locale]/(dashboard)/progress/page.tsx                Replace placeholder, tab shell
  app/[locale]/(dashboard)/progress/report/page.tsx         Printable report page
  components/progress/ProgressPage.tsx                      Tab strip + state
  components/progress/LogTab.tsx                            Today's quick log + detailed form
  components/progress/StreaksTab.tsx                        Streak cards + per-child / per-subject lists
  components/progress/ReportTab.tsx                         Web preview of the report
  components/progress/StreakCard.tsx                        Reusable single-streak card
  components/progress/TeachingHeatmap.tsx                   GitHub-style heatmap
  components/progress/LogEntryRow.tsx                       One row in today's entries / heatmap popover
  components/progress/PrintableReport.tsx                   The actual printable sheet (used by report page)
  hooks/useProgressSummary.ts                               Data-fetching hook
  hooks/useProgressReport.ts                                Data-fetching hook for the printable route
```

### 12.1 Files to modify

```
apps/web/middleware.ts                     Add `/progress`, `/progress/report` to PROTECTED_PATHS if not already matched by the dashboard group
apps/web/messages/en.json                  Add `Progress` namespace (§10)
apps/web/app/globals.css                   Add `@media print` rules for `.progress-report-sheet` (§6.3)
apps/api/app/main.py                       Register progress router with `prefix="/api/v1"`
apps/web/components/dashboard/...          Add optional "Teaching streak" card (§8.1) — separate PR acceptable
```
