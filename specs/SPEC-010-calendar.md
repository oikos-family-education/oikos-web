# SPEC-010 — Calendar

**Platform:** Oikos — Open Source Family Education Platform
**Version:** 1.0
**Status:** Ready for implementation

---

## 1. Overview

The **Calendar** is the connective tissue of Oikos. It gives families a unified dated view of everything educational and family-related happening across the year:

- **Family events** — field trips, holidays, appointments, celebrations, co-op days.
- **Subject events** — a special lesson, a recitation, a test, a presentation day.
- **Project milestones** — auto-surfaced from project milestone due dates.
- **Curriculum dates** — curriculum start/end dates surfaced automatically.
- **Routine entries** — recurring blocks from the active week template shown as a repeating background so the parent sees the full picture.

The week planner remains the tool for defining *what* happens every week as a routine. The calendar is the tool for *one-time or recurring dated events* and for seeing the whole picture at a glance.

---

## 2. Core Concepts

| Term | Definition |
|---|---|
| **Event** | A dated, titled occurrence with an optional time, tied optionally to children, a subject, and/or a project. Created and managed by the parent. |
| **System event** | A read-only event automatically surfaced from another entity (project milestone, curriculum start/end). Not editable in the calendar — link takes the parent to the source. |
| **Routine projection** | A faded, non-editable rendering of the active week template's routine entries on the calendar grid. Background context only. |
| **Event type** | One of `family`, `subject`, `project`, `curriculum` (system). Drives the color legend and filtering. |
| **All-day event** | An event without a start/end time. Renders in the date header band, not the time grid. |
| **Recurrence** | Simple recurrence rules: `none`, `weekly`, `monthly`, `yearly`. Complex rrule patterns are out of scope for v1. |

---

## 3. Data Model

### 3.1 `calendar_events`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | PK | |
| `family_id` | UUID | FK → `families`, NOT NULL | All events are family-scoped |
| `title` | VARCHAR(255) | NOT NULL | |
| `description` | TEXT | NULLABLE | |
| `event_type` | ENUM | NOT NULL, default `family` | See §3.1.1 |
| `all_day` | BOOLEAN | NOT NULL, default `false` | |
| `start_at` | TIMESTAMPTZ | NOT NULL | For all-day events store midnight UTC |
| `end_at` | TIMESTAMPTZ | NOT NULL | `start_at + 1h` default for timed; `start_at + 1d` for all-day |
| `child_ids` | UUID[] | NOT NULL, default `{}` | 0 = whole family |
| `subject_id` | UUID | FK → `subjects`, NULLABLE | |
| `project_id` | UUID | FK → `projects`, NULLABLE | |
| `color` | VARCHAR(7) | NULLABLE | Hex override; defaults to type color if null |
| `location` | VARCHAR(255) | NULLABLE | |
| `recurrence` | ENUM | NOT NULL, default `none` | See §3.1.2 |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### 3.1.1 `calendar_event_type` enum

```
family | subject | project | curriculum
```

- `family` — Generic household event. Default.
- `subject` — Tied to a subject (special lesson, presentation day).
- `project` — Tied to a project. Usually created from a milestone due date.
- `curriculum` — Reserved for auto-surfaced curriculum boundary events.

#### 3.1.2 `calendar_event_recurrence` enum

```
none | weekly | monthly | yearly
```

For `weekly` recurrence the event repeats on the same weekday as `start_at`.
For `monthly` it repeats on the same day-of-month.
For `yearly` it repeats on the same month+day.

There is no end-date for recurrence in v1. Recurrence can be cleared when editing any occurrence (edit-this / edit-all modal).

### 3.2 Indexes

- `(family_id, start_at)` — primary query pattern.
- `(subject_id)`, `(project_id)` — for reverse-lookup from those entities.

### 3.3 System events (no table)

Project milestone due dates and curriculum start/end dates are **not stored** in `calendar_events`. They are fetched alongside user events at query time and merged in the API service layer before returning to the frontend. They are identifiable by `is_system: true` in the response schema and link back to their source entity.

---

## 4. API

All routes mounted at `/api/v1/calendar`.

### 4.1 Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/calendar/events` | List events for a date range. Returns user events + system events merged. |
| `POST` | `/calendar/events` | Create an event. |
| `GET` | `/calendar/events/{id}` | Get a single event. |
| `PATCH` | `/calendar/events/{id}` | Update an event. |
| `DELETE` | `/calendar/events/{id}` | Delete an event. |

### 4.2 `GET /calendar/events` query parameters

| Param | Type | Required | Notes |
|---|---|---|---|
| `from` | ISO date | Yes | Start of range (inclusive). |
| `to` | ISO date | Yes | End of range (inclusive). |
| `child_id` | UUID | No | Filter to events that include this child. |
| `event_type` | string | No | Comma-separated list of types to include. |
| `include_system` | bool | No | Default `true`. Pass `false` to exclude milestones and curriculum dates. |
| `include_routine` | bool | No | Default `false`. If `true`, return routine projection blocks from the active week template expanded over the range. |

### 4.3 Response shape

```json
{
  "events": [
    {
      "id": "uuid",
      "title": "Field trip — Natural History Museum",
      "event_type": "family",
      "all_day": true,
      "start_at": "2026-04-22T00:00:00Z",
      "end_at": "2026-04-23T00:00:00Z",
      "child_ids": ["uuid1", "uuid2"],
      "subject_id": null,
      "project_id": null,
      "color": "#4f46e5",
      "location": "Natural History Museum, London",
      "recurrence": "none",
      "is_system": false
    },
    {
      "id": "milestone-uuid",
      "title": "Milestone: Draft submitted — History Essay",
      "event_type": "project",
      "all_day": true,
      "start_at": "2026-04-25T00:00:00Z",
      "end_at": "2026-04-26T00:00:00Z",
      "child_ids": ["uuid1"],
      "project_id": "project-uuid",
      "is_system": true,
      "source_url": "/projects/project-uuid"
    }
  ]
}
```

---

## 5. Page Layout

### 5.1 Overall structure

```
┌───────────────────────────────────────────────────────────┐
│  HEADER: "Calendar"              [+ Add Event]            │
├────────────┬──────────────────────────────────────────────┤
│ LEFT       │  CALENDAR GRID (main)                        │
│ SIDEBAR    │                                              │
│            │  [Month | Week | Day] toggle (top-right)     │
│ Mini cal   │                                              │
│            │  < April 2026 >                              │
│ Filters    │                                              │
│ Children   │  Mon Tue Wed Thu Fri Sat Sun                 │
│ Types      │  ┌───┬───┬───┬───┬───┬───┬───┐              │
│            │  │   │   │   │   │   │   │   │              │
│            │  │   │   │   │   │   │   │   │              │
│            │  └───┴───┴───┴───┴───┴───┴───┘              │
│            │                                              │
└────────────┴──────────────────────────────────────────────┘
```

### 5.2 Left sidebar

**Mini calendar**
- Single-month compact calendar for navigation.
- Clicking a day jumps the main grid to that week (week view) or month (month view).
- Days with events get a small dot indicator.
- "Today" button below the mini calendar.

**View toggle** (also available in the header above the grid)
- `Month` / `Week` / `Day` — persisted to `localStorage`.

**Child filter**
- Section heading: **"Children"**
- One chip per child in the family: avatar circle + first name.
- Clicking a chip toggles that child's events on/off. Default: all shown.
- An extra chip **"Family"** covers events with no child assignment.

**Type legend / filter**
- Section heading: **"Categories"**
- Color swatch + label for each event type: Family (indigo), Subject (amber), Project (emerald), System (slate).
- Clicking a type toggles its visibility.

**Sidebar width:** `240px`, collapsible on mobile.

### 5.3 Month view (default)

```
         Mon    Tue    Wed    Thu    Fri    Sat    Sun
       ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐
  W14  │  30  │  31  │   1  │   2  │   3  │   4  │   5  │
       │ ●ev  │      │      │      │      │      │      │
       ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
  W15  │   6  │   7  │   8  │   9  │  10  │  11  │  12  │
       │      │ ●ev  │      │      │      │      │      │
       └──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

- **Week row height:** `min 120px`, expandable with content.
- **Day cell:** day number in top-right corner; today gets a filled primary-color circle.
- **Event pill:** `h-5`, rounded, colored background, white truncated title. Pills are stacked vertically up to 3; a **"+ n more"** link at the bottom of the cell opens a day popover showing all events.
- **All-day events and multi-day events** span across cells with a continuous pill (left/right edge rounded only at start/end of the event).
- **System events** (milestones, curriculum) render with a dashed border on the pill.
- **Routine projection blocks** are not shown in month view (too noisy).
- Days outside the current month: muted text and a lighter background.
- Clicking a day cell opens the "Add Event" form pre-filled with that date.
- Clicking an event pill opens the event detail drawer.

### 5.4 Week view

```
        Mon 6   Tue 7   Wed 8   Thu 9   Fri 10  Sat 11  Sun 12
06:00  │                                                        │
07:00  │ ░░░░░░ ░░░░░░░░                                       │  ← routine
08:00  │ ░Math░ ░Latin░░                                       │     projection
09:00  │        ░░░░░░░░  ████████ Field Trip ███████████████  │  ← calendar event
10:00  │                  ████████ (all day)  ███████████████  │
11:00  │                                                        │
...
```

- **Time axis** on the left, from `06:00` to `22:00`, identical layout to the week planner.
- **Routine projection blocks** (from active week template) are shown as translucent grey blocks in the background with a small subject icon. Non-interactive except for a tooltip on hover.
- **Calendar events** are layered on top with full opacity.
- **All-day events** appear in a fixed banner band at the top of each column, above the time grid.
- **Event block:** rounded rectangle, colored, shows title and optionally time. Clicking opens the event detail drawer.
- **Current time indicator:** horizontal line in today's column.
- Navigation: `< previous week` / `> next week` arrows + keyboard left/right arrows.

### 5.5 Day view

- Single column, `06:00–22:00` time grid.
- All-day events in a top banner.
- Routine projection blocks visible as background.
- Calendar events on top.
- Clicking a time slot opens the "Add Event" form pre-filled with that date + time.

---

## 6. Add / Edit Event — Form Drawer

Opens as a right-side drawer (or a centred modal on mobile). The same form is used for create and edit.

### 6.1 Fields

| Field | UI element | Notes |
|---|---|---|
| **Title** `*` | `<Input>` | Required. Max 255 chars. |
| **Event type** `*` | Segmented control: Family / Subject / Project | Default Family. Changing type shows/hides conditional fields. |
| **All day** | Toggle switch | Default off. When on, hides time fields. |
| **Date** `*` | Date picker | Required. |
| **Start time** | Time picker (15-min steps) | Hidden when all-day. |
| **End time** | Time picker | Hidden when all-day. Must be after start time. |
| **Children** | Multi-select chip group (all family children + "Whole family") | Default: whole family. |
| **Subject** | Single-select dropdown (family subjects) | Shown when event type = Subject. |
| **Project** | Single-select dropdown (active projects) | Shown when event type = Project. Selecting a project also allows selecting a milestone. |
| **Milestone** | Single-select dropdown (project milestones) | Shown after a project is selected. Optional. |
| **Recurrence** | Select: None / Weekly / Monthly / Yearly | Default None. |
| **Location** | `<Input>` | Optional. |
| **Description** | `<textarea>` | Optional. Max 1000 chars. |
| **Color** | Color swatch picker (6 presets + type default) | Optional override. |

### 6.2 Validation

- Title is required.
- End time must be ≥ start time when timed event.
- Subject required when event type = Subject.
- Project required when event type = Project.

### 6.3 Editing a recurring event

When editing a recurring event, show a modal:
- **"Edit this event"** — only this occurrence.
- **"Edit all events"** — update all future occurrences.

### 6.4 Form buttons

- **Cancel** — `ghost` variant, closes drawer.
- **Save event** — `primary` variant, `type="submit"`, `disabled={isLoading}`.
- On edit, a **Delete** button appears in the footer (left-aligned), with a confirm step.

---

## 7. Event Detail Drawer

Clicking an event pill/block opens a read view drawer before the edit form. This keeps the click-to-view pattern consistent and fast.

**Contents:**
- Event title (heading)
- Type badge + color swatch
- Date / time (or "All day")
- Recurrence description if set ("Every week")
- Assigned children avatars
- Subject or project link (underlined, navigates to the entity)
- Milestone name if linked
- Location (with a small map-pin icon)
- Description
- Footer: **Edit** button → opens Edit form. **Delete** → confirm inline.

System events (milestones, curriculum) only show **View in project / curriculum** instead of Edit/Delete.

---

## 8. "Add Event" Quick Access

- **Header button:** `+ Add Event` button in the top-right of the page. Opens the form drawer with today's date pre-filled.
- **Month view cell click:** clicking an empty day cell opens the form with that date.
- **Week / Day view click:** clicking an empty time slot opens the form with that date + time.
- **FAB on mobile:** floating `+` button fixed to bottom-right.

---

## 9. Integration with Other Features

### 9.1 Projects

- Project milestone due dates appear automatically on the calendar (system events).
- From an event linked to a project, clicking the project name navigates to `/projects/[id]`.
- When a project is completed or archived, its milestone system events are greyed out on the calendar.

### 9.2 Subjects & Curriculum

- Curriculum start/end dates surface as full-day system events labeled e.g. *"[Curriculum name] begins"* / *"[Curriculum name] ends"*.
- Subject events created in the calendar appear on the subject detail page in a future "events" tab (out of scope for v1 — link is one-directional for now).

### 9.3 Week Planner

- The active week template's routine entries are projected onto the week/day views as faded blocks.
- These blocks are **read-only** in the calendar. Clicking them shows a tooltip: *"Routine event — manage in Planner"* with a link.
- Routine blocks are **not** shown in month view.

### 9.4 Dashboard

- The main dashboard shows an **"Upcoming"** card listing the next 5 events across all types (excluding routine projections). Each item links to the calendar with the event highlighted.

---

## 10. Design & UX Details

### 10.1 Color system for event types

| Type | Default color token | Tailwind pill class |
|---|---|---|
| Family | Indigo `#6366f1` | `bg-indigo-500` |
| Subject | Amber `#f59e0b` | `bg-amber-400` |
| Project | Emerald `#10b981` | `bg-emerald-500` |
| System (milestone, curriculum) | Slate `#64748b` | `bg-slate-400` with dashed border |
| Routine projection | N/A | `bg-slate-200 opacity-60` |

### 10.2 Empty states

- **No events this month:** A centered illustration and text: *"No events this month. Add one with the button above."*
- **All filters hidden:** *"No events match your current filters."*

### 10.3 Responsive behaviour

- On screens < `lg`: sidebar collapses into a top drawer accessible via a filter icon.
- Month view is maintained but cells shrink; event pills truncate to the color bar only.
- Week view collapses to a 3-day view on mobile.
- Day view is used as the main view on very small screens.

### 10.4 Keyboard navigation

- Month view: arrow keys move between day cells; `Enter` or `Space` opens the add-event form.
- `Escape` closes any open drawer or modal.
- View toggle: `M` (month), `W` (week), `D` (day).

---

## 11. i18n Namespaces

Add a `Calendar` namespace to `messages/en.json`. Keys needed at minimum:

```json
"Calendar": {
  "title": "Calendar",
  "addEvent": "Add event",
  "today": "Today",
  "month": "Month",
  "week": "Week",
  "day": "Day",
  "noEventsThisMonth": "No events this month. Add one with the button above.",
  "noEventsFiltered": "No events match your current filters.",
  "allDay": "All day",
  "recurrenceNone": "Does not repeat",
  "recurrenceWeekly": "Every week",
  "recurrenceMonthly": "Every month",
  "recurrenceYearly": "Every year",
  "editThisEvent": "Edit this event",
  "editAllEvents": "Edit all future events",
  "deleteEvent": "Delete event",
  "routineTooltip": "Routine event — manage in Planner",
  "systemEventLink": "View in {source}",
  "eventTypeFamily": "Family",
  "eventTypeSubject": "Subject",
  "eventTypeProject": "Project",
  "saveEvent": "Save event",
  "wholeFamily": "Whole family",
  "moreEvents": "+ {count} more"
}
```

---

## 12. Out of Scope (v1)

- iCal / `.ics` export or Google Calendar sync.
- Inviting external people to events.
- Complex recurrence rules (every 2nd Tuesday, last Friday of month, etc.).
- Push or email notifications for upcoming events.
- Attendee RSVP.
- Event reminders.
- Attaching files or media to events directly (link to projects/resources instead).

These are recorded as future possibilities, not deferrals with a commitment.

---

## 13. File Map (new files)

```
apps/api/
  app/models/calendar.py              CalendarEvent ORM model
  app/schemas/calendar.py             Request + response Pydantic schemas
  app/services/calendar_service.py    Business logic (CRUD + system event merge)
  app/routers/calendar.py             FastAPI router
  alembic/versions/XXXX_add_calendar_events.py

apps/web/
  app/[locale]/(dashboard)/calendar/page.tsx         Replace placeholder
  components/calendar/CalendarPage.tsx               Outer shell + state
  components/calendar/MonthView.tsx                  Month grid
  components/calendar/WeekView.tsx                   Week grid + routine projection
  components/calendar/DayView.tsx                    Day view
  components/calendar/MiniCalendar.tsx               Sidebar mini-cal
  components/calendar/EventPill.tsx                  Pill/block renderer
  components/calendar/EventDetailDrawer.tsx          Read view
  components/calendar/EventFormDrawer.tsx            Add/edit form
  components/calendar/CalendarSidebar.tsx            Sidebar with filters
  components/calendar/RoutineProjectionBlock.tsx     Faded routine overlay
```
