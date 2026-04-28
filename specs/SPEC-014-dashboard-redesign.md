# SPEC-014 — Dashboard Redesign

**Platform:** Oikos — Open Source Family Education Platform
**Version:** 1.0
**Status:** Ready for implementation
**Depends on:** SPEC-003 (shell & navigation), SPEC-004 (subjects & curricula), SPEC-005 (week planner), SPEC-009 (projects), SPEC-010 (calendar), SPEC-011 (progress), SPEC-013 (notes)

---

## 1. Overview

The Dashboard (`/dashboard`) is the daily command center of Oikos — the first screen parents open every morning. Its current implementation (a static welcome message and a grid of navigation shortcut cards) is replaced in full with a rich, data-driven view centered on **today**.

The redesigned dashboard must answer three questions at a glance:

1. **What is happening today?** — scheduled events and planned routine sessions.
2. **What is the family working on?** — active curricula, ongoing projects, and actionable notes.
3. **What needs attention?** — streak health, subjects that have been neglected, and upcoming due dates.

It is also the entry point for the most frequent daily actions: logging a teaching session, capturing a note, and adding a calendar event.

---

## 2. What Gets Removed

The following components are **deleted** as part of this spec:

- `apps/web/components/dashboard/NavigationCards.tsx`
- `apps/web/components/dashboard/WelcomeSection.tsx`
- All imports and usages of both in `apps/web/app/[locale]/(dashboard)/dashboard/page.tsx`

The sidebar navigation already provides access to all platform areas, so standalone shortcut cards are redundant and consume valuable space.

---

## 3. Goals

- Give parents a single screen that replaces morning planning across multiple separate pages.
- Surface the right information for today without requiring any navigation.
- Make the most common daily actions (log progress, create a note) available directly on the dashboard.
- Celebrate progress — achievements, streaks, and milestones should be visible and motivating.
- Warn parents proactively when something needs attention (neglected subjects, overdue notes).

---

## 4. Out of Scope / Deferred

| Item | Reason |
|---|---|
| Drag-and-drop reordering of dashboard widgets | Post-MVP customisation |
| Per-child dashboard view | Child-specific views belong in the Children page |
| AI-generated daily summary | Assistant spec |
| Push notifications / reminders | Notifications spec |
| Dashboard settings (show/hide widgets) | Post-MVP |
| Real-time updates (websocket) | Post-MVP |

---

## 5. Dashboard Sections

The dashboard is composed of the following sections. Every section must have a meaningful empty state — no blank boxes.

### 5.1 Hero

Replaces the current `WelcomeSection`. Displays:

- **Family Coat of Arms** — rendered using the existing `ShieldPreview` component at a small size. If `family.has_coat_of_arms` is `false`, show a placeholder shield icon with a subtle "Set up coat of arms" link pointing to `/family`.
- **Family name** and a **time-aware greeting** addressed to the logged-in parent's first name (morning / afternoon / evening), consistent with the greeting keys already in the `Dashboard` i18n namespace.
- **Today's date** in a human-friendly format (e.g. "Friday, 25 April 2026").
- **Three quick-action buttons**: `Log Progress`, `New Note`, `Add Event`. These open inline modals (see §5.5 and §5.7). `Add Event` links to `/calendar?new=1`.

Data sources: `useAuth()` for `family.shield_config`, `family.family_name`, `family.has_coat_of_arms`, `user.first_name`.

### 5.2 Today's Schedule

Shows everything the family has planned for today, combining two sources in a single chronological list:

1. **Calendar events** for today — from `GET /api/v1/calendar/events?from={today}&to={today}`.
2. **Week planner routine entries** for today's day of week — from the new `GET /api/v1/week-planner/today` endpoint (see §7.1).

Display requirements:

- Entries are sorted by start time. Routine entries use `start_minute` (minutes from midnight); calendar events use `start_at`.
- Each entry shows: start time, title (subject name for routine entries, event title for calendar events), duration, assigned children (as initials badges, max 3 then "+N"), and a color indicator. The source (week planner vs. calendar) is noted as a sub-label.
- Free-time routine slots are visually de-emphasized (lighter style).
- If there are many entries, the list is internally scrollable rather than expanding the card indefinitely.
- An empty state guides the user to `/calendar` or `/planner`.
- Header includes shortcut links to both `/calendar` and `/planner`.

Clicking a calendar event links to `/calendar?event={id}`. Clicking a routine entry links to `/planner`.

### 5.3 Active Curriculums

Shows all curricula with `status = active`. Each curriculum displays:

- Name, period type (semester, quarterly, etc.), number of subjects, number of enrolled children.
- A progress bar if progress data is available (derived from teaching logs vs. curriculum targets).

Each curriculum card is fully clickable and links to `/curriculums/{id}`.

Empty state: a prompt to create a curriculum at `/curriculums`.

Header includes a "View all" link to `/curriculums`.

Data source: `GET /api/v1/curriculums?status=active`.

### 5.4 Ongoing Projects

Shows all projects with `status = active`. Each project displays:

- Title, assigned children, milestone progress (`done / total`), a progress bar.
- Due date with urgency: amber text if due within 7 days, red text if overdue.

Each row is clickable and links to `/projects/{id}`.

Empty state: a prompt to create a project at `/projects`.

Header includes a "View all" link to `/projects`.

Data source: `GET /api/v1/projects?status=active`.

### 5.5 Progress & Streak

Motivates teaching consistency. Displays:

- **Streak banner** — current streak in weeks (or days if the streak calculation is day-based per the progress spec). If streak is 0, an encouraging prompt to start one.
- **This-week mini chart** — seven small indicators (Mon–Sun) showing whether each day has any teaching log. Today's indicator highlights if no log has been recorded yet.
- **Quick Log button** — opens `QuickProgressModal` (inline modal).

`QuickProgressModal` fields:
- Child selector (checkboxes from family children, "All children" pre-selected)
- Subject selector (from `GET /api/v1/subjects?source=mine`)
- Duration in minutes (optional)
- Optional notes

On submit: `POST /api/v1/progress/logs`. On success: re-fetch the progress summary and show a success toast.

Header includes a "Full report" link to `/progress`.

Data source: `GET /api/v1/progress/summary?from={30daysAgo}&to={today}` — reuses the existing summary endpoint defined in SPEC-011.

### 5.6 Neglected Subjects

Proactively surfaces subjects that have not been taught in the last 14 or more days, so parents can reprioritize.

Each neglected subject displays: subject name, days since last logged session, and assigned children.

Color-coded urgency: amber for 14–20 days without a log, red for more than 20 days.

If more than 5 subjects are neglected, show the top 5 with a "Show N more" link to `/progress`.

Empty state: a positive confirmation that all subjects have been taught recently (with a success icon).

Clicking a subject row links to `/subjects/{id}`.

Data source: `GET /api/v1/progress/neglected` (new endpoint — see §7.2).

### 5.7 Notes Panel

A three-column Kanban-style view of actionable notes, grouped by status:

| Column | Status filter |
|---|---|
| To Do | `todo` |
| In Progress | `in_progress` |
| To Remember | `to_remember` |

Each column shows up to 5 notes. Pinned notes appear first within each column. Each note card shows: content excerpt (2 lines max), optional due date (red if overdue), optional entity link label (subject name, child name, etc.), and a pin indicator if pinned.

If a column has more than 5 notes, a "+N more" link filters `/notes` to that status.

Clicking a note links to `/notes?id={note_id}`.

Each column has an inline "+ Add note" button that opens `QuickNoteModal` with the column's status pre-selected.

`QuickNoteModal` fields:
- Content (required textarea)
- Status (pre-filled, editable)
- Optional tags

On submit: `POST /api/v1/notes`. On success: re-fetch the notes list.

Header includes a "All notes" link to `/notes`.

Data source: `GET /api/v1/notes?status=todo,in_progress,to_remember&limit=15`.

### 5.8 Journal Entries

Shows the last 3 notes with `status = history_only` — pure reflective journal entries with no actionable intent (daily logs, observations, memories). This is intentionally separate from the Kanban notes panel (§5.7), which handles actionable statuses only.

The design must reflect the journaling nature of these entries: warmer, more narrative, less task-like. Each entry displays:

- The note content, showing more text than the Kanban cards (up to 4–5 lines before truncating) to preserve the reflective character of journal writing.
- The creation date in a human-friendly format (e.g. "Yesterday", "Monday, Apr 21").
- An optional entity link label if the note is linked to a child, subject, or project.
- The author's first name, since both parents may contribute journal entries.

Clicking an entry links to `/notes?id={note_id}&status=history_only`.

Empty state: an encouraging prompt to start journaling, with a "Write your first journal entry" shortcut that opens `QuickNoteModal` pre-filled with `status = history_only`.

Header includes a "+ New entry" button (opens `QuickNoteModal` with `status = history_only` pre-filled) and a "View all" link to `/notes?status=history_only`.

Data source: `GET /api/v1/notes?status=history_only&sort=created_at_desc&limit=3`.

### 5.9 Recent Certificates

Celebrates the most recent learning achievements — `ChildAchievement` records generated when projects are completed.

Each certificate card shows: child name, project title, and completion date.

Cards are displayed in a horizontally scrollable row with touch-friendly swipe support.

Clicking a card links to `/projects/{project_id}`.

This section is **hidden entirely** if no achievements exist (not an empty state — just absent).

Data source: `GET /api/v1/projects/achievements?limit=10` (new endpoint — see §7.3).

---

## 6. UX Requirements

- **Beautiful and polished** — the dashboard is the face of the platform; it must feel purposeful and well-crafted, not utilitarian.
- **Responsive** — must be fully usable and visually coherent at any screen size, from mobile phones to wide desktop monitors. The layout must not break when the browser window is resized.
- **Fast** — each section fetches its data independently so a slow endpoint does not block the rest of the page from rendering.
- **Skeleton loading** — each section shows a skeleton placeholder while its data loads. No blank or shifting boxes.
- **Error states** — if a section's fetch fails, show a quiet inline error with a retry button. The rest of the dashboard remains functional.
- **Inline modals** — `QuickProgressModal` and `QuickNoteModal` open without navigating away. They dismiss on backdrop click or Escape key. On mobile they appear as a bottom sheet; on desktop as a centered modal.
- **Accessible** — section headings use `<h2>` elements. Color is never the sole differentiator (streak and neglected-subject urgency indicators also use icons and text). All interactive elements have visible focus rings.
- **No hardcoded strings** — all user-facing text uses `useTranslations` from `next-intl`.

---

## 7. New API Endpoints Required

### 7.1 `GET /api/v1/week-planner/today`

Returns routine entries for today's day of week from the currently active week template.

**Logic:**
1. Find the `WeekTemplate` where `family_id = current_family.id` and `is_active = true`.
2. Determine today's `day_of_week` using Python's `datetime.weekday()` (0 = Monday, 6 = Sunday).
3. Return all `RoutineEntry` rows for that template and day, joined with subject name and child names.

**Response:**
```json
[
  {
    "id": "uuid",
    "subject_id": "uuid",
    "subject_name": "Mathematics",
    "is_free_time": false,
    "child_ids": ["uuid"],
    "child_names": ["Emma", "Liam"],
    "day_of_week": 4,
    "start_minute": 540,
    "duration_minutes": 45,
    "priority": "high",
    "color": "#6366f1"
  }
]
```

If no active template exists, returns an empty array (not a 404).

**Files:** `apps/api/app/routers/week_planner.py`, `apps/api/app/services/week_planner_service.py`, `apps/api/app/schemas/week_planner.py` (add `TodayRoutineEntryResponse`).

---

### 7.2 `GET /api/v1/progress/neglected`

Returns subjects that have not been taught in the last N days.

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `threshold_days` | int | 14 | Minimum days without a log to be considered neglected |

**Logic:**
1. Collect all subjects associated with the current family — subjects appearing in any `CurriculumSubject` row where the curriculum's `family_id` matches.
2. For each subject, find the most recent `TeachingLog` entry (`subject_id = subject.id`, `family_id = current_family.id`).
3. If the most recent log's `taught_on` is older than `today - threshold_days`, or if there is no log at all for that subject, include it in the result.
4. Join child names from the children enrolled in the subject's active curriculum.
5. Order by `days_since_last_log DESC` (most neglected first).

**Response:**
```json
[
  {
    "subject_id": "uuid",
    "subject_name": "Latin",
    "days_since_last_log": 18,
    "last_taught_on": "2026-04-07",
    "assigned_child_names": ["Emma", "Liam"]
  }
]
```

**Files:** `apps/api/app/routers/progress.py`, `apps/api/app/services/progress_service.py`, `apps/api/app/schemas/progress.py` (add `NeglectedSubjectResponse`).

---

### 7.3 `GET /api/v1/projects/achievements`

Returns recent `ChildAchievement` records for all children in the current family.

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | int | 10 | Maximum records to return |

**Logic:**
1. Join `ChildAchievement` → `Project` where `project.family_id = current_family.id`.
2. Join `Child` to get `child.first_name`.
3. Order by `ChildAchievement.created_at DESC`.
4. Apply `limit`.

**Response:**
```json
[
  {
    "achievement_id": "uuid",
    "child_name": "Emma",
    "project_title": "Egyptian History",
    "project_id": "uuid",
    "completed_at": "2026-04-20"
  }
]
```

**Files:** `apps/api/app/routers/projects.py`, `apps/api/app/services/project_service.py`, `apps/api/app/schemas/project.py` (add `AchievementResponse`).

---

## 8. i18n

Add or update the `Dashboard` namespace in `apps/web/messages/en.json`. The existing keys (`greeting_morning`, `greeting_afternoon`, `greeting_evening`, `encouragement`, `quickAccess`) can be removed or repurposed. Add:

```json
"Dashboard": {
  "greeting_morning": "Good morning, {name}!",
  "greeting_afternoon": "Good afternoon, {name}!",
  "greeting_evening": "Good evening, {name}!",
  "todayDate": "Today is {date}",
  "setupShield": "Set up coat of arms",
  "quickLogProgress": "Log Progress",
  "quickNewNote": "New Note",
  "quickAddEvent": "Add Event",

  "todayTitle": "Today",
  "todayEmpty": "Nothing scheduled for today.",
  "todayEmptyHint": "Add an event or set up your week planner.",
  "sourceWeekPlanner": "Week planner",
  "sourceCalendar": "Calendar event",
  "linkCalendar": "Calendar",
  "linkPlanner": "Planner",

  "curriculumsTitle": "Curriculums",
  "curriculumsViewAll": "View all",
  "curriculumsEmpty": "No active curricula.",
  "curriculumsEmptyHint": "Start one in Curriculums.",
  "curriculumsSubjects": "{count} subjects",
  "curriculumsChildren": "{count} children",

  "projectsTitle": "Projects",
  "projectsViewAll": "View all",
  "projectsEmpty": "No active projects.",
  "projectsDueIn": "Due in {days} days",
  "projectsDueToday": "Due today",
  "projectsOverdue": "{days} days overdue",
  "projectsMilestones": "{done}/{total} milestones",

  "progressTitle": "Progress",
  "progressFullReport": "Full report",
  "progressStreakWeeks": "{count}-week streak",
  "progressStreakDays": "{count}-day streak",
  "progressStreakStart": "Start your streak today — log a session below.",
  "progressLogButton": "Log today's session",
  "progressLogSuccess": "Logged!",

  "neglectedTitle": "Needs Attention",
  "neglectedDaysAgo": "{days} days ago",
  "neglectedNone": "All subjects taught recently. Great work!",
  "neglectedShowMore": "Show {count} more",

  "notesTitle": "Notes",
  "notesViewAll": "All notes",
  "notesColumnTodo": "To Do",
  "notesColumnInProgress": "In Progress",
  "notesColumnRemember": "To Remember",
  "notesAddTodo": "+ Add task",
  "notesAddInProgress": "+ Add note",
  "notesAddRemember": "+ Add reminder",
  "notesMore": "+{count} more",
  "notesDue": "Due {date}",
  "notesOverdue": "Overdue",

  "certificatesTitle": "Recent Certificates",
  "certificatesCompleted": "Completed {date}",

  "quickLogTitle": "Log a Session",
  "quickLogChild": "Child",
  "quickLogAllChildren": "All children",
  "quickLogSubject": "Subject",
  "quickLogMinutes": "Duration (minutes)",
  "quickLogNotes": "Notes (optional)",
  "quickLogSubmit": "Log session",

  "quickNoteTitle": "New Note",
  "quickNoteContent": "What's on your mind?",
  "quickNoteTags": "Tags (comma-separated)",
  "quickNoteStatus": "Status",
  "quickNoteSubmit": "Save note",

  "journalTitle": "Journal",
  "journalViewAll": "View all",
  "journalNewEntry": "+ New entry",
  "journalEmpty": "No journal entries yet.",
  "journalEmptyHint": "Write your first journal entry.",
  "journalBy": "By {name}",
  "journalToday": "Today",
  "journalYesterday": "Yesterday"
}
```

---

## 9. Acceptance Criteria

| # | Criteria |
|---|---|
| 1 | The dashboard no longer shows `NavigationCards` or `WelcomeSection` |
| 2 | The Hero section shows the family coat of arms (or placeholder), the family name, today's date, and a time-aware greeting |
| 3 | The three quick-action buttons are visible and functional |
| 4 | Today's Schedule shows calendar events and week planner routine entries for the current day, merged and sorted by time |
| 5 | Today's Schedule shows an appropriate empty state when nothing is scheduled |
| 6 | Active Curriculums shows all curricula with `status = active`, each linking to the curriculum detail page |
| 7 | Ongoing Projects shows all `active` projects with due-date urgency indicators |
| 8 | The Progress widget shows the current streak and the this-week mini chart |
| 9 | The Quick Log modal allows logging a teaching session and updates the streak widget on success |
| 10 | Neglected Subjects shows subjects not taught in 14+ days with urgency coloring |
| 11 | Neglected Subjects shows a positive empty state when all subjects are current |
| 12 | The Notes panel shows up to 5 notes per column across the three active statuses |
| 13 | Each Notes column has a working "Add note" button that opens the Quick Note modal |
| 14 | Quick Note modal creates a note and refreshes the panel |
| 15 | The Journal section shows the last 3 `history_only` notes with content, date, author, and optional entity label |
| 16 | The Journal empty state has a working "Write your first journal entry" shortcut that opens the quick note modal pre-filled with `status = history_only` |
| 17 | The Journal "+ New entry" button and "View all" link work correctly |
| 18 | Recent Certificates are visible when achievements exist; the section is absent when there are none |
| 19 | Every section has a skeleton loader while data is fetching |
| 20 | A failed section fetch shows an inline error with a retry button without breaking other sections |
| 21 | The page is fully usable on mobile and does not break on window resize |
| 22 | All user-facing strings come from `useTranslations('Dashboard')` |
| 23 | The three new backend endpoints return correct data and handle the "no data" case gracefully |

---

## 10. Implementation Order

| Phase | Deliverables |
|---|---|
| **1 — Backend** | `GET /week-planner/today`, `GET /progress/neglected`, `GET /projects/achievements` — schemas, services, router additions |
| **2 — Hero** | `DashboardHero` with coat of arms, greeting, date, quick-action buttons (modals can be stubs at this point) |
| **3 — Today's Schedule** | `TodaySchedule` combining both data sources |
| **4 — Notes Panel** | `DashboardNotes` with three columns and `QuickNoteModal` |
| **5 — Progress Widget** | `ProgressWidget` with streak, mini chart, and `QuickProgressModal` |
| **6 — Curriculums + Projects** | `ActiveCurriculums` and `OngoingProjects` (both use existing endpoints) |
| **7 — Neglected Subjects** | `NeglectedSubjects` (requires Phase 1 backend endpoint) |
| **8 — Journal** | `DashboardJournal` with the last 3 `history_only` entries and new-entry shortcut |
| **9 — Certificates** | `RecentCertificates` horizontal scroll (requires Phase 1 backend endpoint) |
| **10 — Cleanup** | Delete `NavigationCards.tsx`, delete `WelcomeSection.tsx`, update `dashboard/page.tsx`, add i18n keys |

---

## 11. Files to Create / Modify

### New files

| File | Purpose |
|---|---|
| `apps/web/components/dashboard/DashboardHero.tsx` | Hero section with coat of arms, greeting, quick actions |
| `apps/web/components/dashboard/TodaySchedule.tsx` | Merged today view from calendar + planner |
| `apps/web/components/dashboard/ActiveCurriculums.tsx` | Active curriculum cards |
| `apps/web/components/dashboard/OngoingProjects.tsx` | Active project rows |
| `apps/web/components/dashboard/ProgressWidget.tsx` | Streak banner, week chart, quick log trigger |
| `apps/web/components/dashboard/QuickProgressModal.tsx` | Inline log session modal |
| `apps/web/components/dashboard/NeglectedSubjects.tsx` | Subjects not taught recently |
| `apps/web/components/dashboard/DashboardNotes.tsx` | Three-column notes Kanban |
| `apps/web/components/dashboard/QuickNoteModal.tsx` | Inline create note modal (shared by Notes panel and Journal) |
| `apps/web/components/dashboard/DashboardJournal.tsx` | Last 3 journal entries (`history_only` status) |
| `apps/web/components/dashboard/RecentCertificates.tsx` | Horizontal certificate scroll |

### Modified files

| File | Change |
|---|---|
| `apps/web/app/[locale]/(dashboard)/dashboard/page.tsx` | Replace with new widget grid; remove old component imports |
| `apps/web/components/dashboard/NavigationCards.tsx` | **Delete** |
| `apps/web/components/dashboard/WelcomeSection.tsx` | **Delete** |
| `apps/web/messages/en.json` | Replace `Dashboard` namespace content (§8) |
| `apps/api/app/routers/week_planner.py` | Add `GET /today` route |
| `apps/api/app/services/week_planner_service.py` | Add `get_today_routine()` function |
| `apps/api/app/schemas/week_planner.py` | Add `TodayRoutineEntryResponse` |
| `apps/api/app/routers/progress.py` | Add `GET /neglected` route |
| `apps/api/app/services/progress_service.py` | Add `get_neglected_subjects()` function |
| `apps/api/app/schemas/progress.py` | Add `NeglectedSubjectResponse` |
| `apps/api/app/routers/projects.py` | Add `GET /achievements` route |
| `apps/api/app/services/project_service.py` | Add `get_recent_achievements()` function |
| `apps/api/app/schemas/project.py` | Add `AchievementResponse` |
