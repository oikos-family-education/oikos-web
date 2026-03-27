# Oikos — Weekly Planner Page Spec
**Feature:** Weekly Routine Planner
**Version:** 1.2
**Platform:** Oikos (Next.js + Tailwind CSS)

---

## 1. Overview

The Weekly Planner is a drag-and-drop scheduling page that allows parents to build a structured weekly routine for their children's education. It is **not a calendar** — it is a reusable weekly template that represents a family's recurring schedule. Parents assign subjects from each child's active curriculum to days and time slots, configure duration, and manage the order of activities throughout the week.

---

## 2. Page Layout

### 2.1 Grid Structure

The planner is a full-width, scrollable grid with the following axes:

- **Columns:** 7 days of the week (Monday → Sunday), plus a fixed left-side time axis column
- **Rows:** Time slots from **06:00 to 22:00** (6 AM to 10 PM), in **1-hour increments** (i.e., 17 rows: 06:00, 07:00 … 22:00). Each row represents one hour and is the **drag snap unit**.
- Each hour row is visually subdivided by a lighter half-hour guide line (purely decorative — not a drop zone boundary)
- The intersection of a day column and an hour row is a **drop zone**

### 2.2 Time Axis (Left Column)

- Fixed/sticky on the left side during horizontal scroll
- Display hour labels (06:00, 07:00 … 22:00) aligned to the top of each row
- A subtle half-hour guide line is drawn at the midpoint of each row (no label)
- Minimum column width: `72px`

### 2.3 Day Columns

- Header row: Day name (`Monday`, `Tuesday`, etc.), sticky at the top during vertical scroll
- Minimum column width: `180px`; columns expand to fill available viewport width
- Each column is independently scrollable vertically within the grid

### 2.4 Current Day Highlight

- If viewing the planner on a weekday that matches a column header, apply a subtle highlight (background tint) to that column's header

---

## 3. Subject Panel (Sidebar)

A collapsible left-side panel that lists **draggable subject tiles** grouped by child.

### 3.1 Panel Header

- Title: **"Curriculum"**
- Toggle button to expand/collapse the panel

### 3.2 Subject Tile (Draggable Source)

Each subject in a child's active curriculum appears as a draggable tile in the panel.

**Tile displays:**
| Field | Description |
|---|---|
| Icon | Subject icon (emoji or lucide icon defined on the Subject entity) |
| Subject name | e.g., "Mathematics", "Latin", "Scripture" |
| Child name(s) | The child(ren) this subject belongs to |
| Priority badge | Color-coded: 🔴 High / 🟡 Medium / 🟢 Low |
| Color accent | Left border or background tint matching the subject's assigned color |

**Behaviour:**
- Tiles can be dragged from the panel into any day/time drop zone on the grid
- A subject tile can be added to **multiple days** (each placement is an independent routine entry)
- Tiles remain in the panel after being dropped (they are templates, not moved)
- Tiles are grouped under a collapsible child section header (e.g., "📚 Emma · Age 9")

### 3.3 Free Time Tile

A special always-available generic tile at the top of the panel:
- Icon: 🌿 (or a configurable leaf/sun icon)
- Label: **"Free Time / Free Play"**
- No child assignment, no subject — acts as a placeholder block
- Can be dropped into any slot like any other subject

---

## 4. Routine Entry (Dropped Item / Grid Card)

When a subject tile is dropped onto the grid, it creates a **Routine Entry** — a positioned card within the grid.

### 4.1 Visual Appearance

```
┌────────────────────────────┐
│ 📐  Mathematics            │
│ [09:00] → 45 min           │
│ Emma · 🔴 High             │
└────────────────────────────┘
```

- **Icon** — Subject icon, 20px
- **Subject name** — Bold, truncated with ellipsis if needed
- **Inline time display** — Shows the exact start time (e.g., `09:00`). Clicking this value activates a small inline time input (HH:MM, free text, any minute value accepted — e.g. `11:17`). Confirming updates the card's start time without opening the full popup. The card repositions on the grid to reflect the new time while remaining in the same hour row.
- **Duration** — Displayed as `X min` or `X hr Y min`
- **Child name(s)** — Sub-label, comma-separated if multiple children
- **Priority badge** — Small colored dot or tag
- **Color** — Card background or left border uses the subject's color
- Card height is proportional to duration (1 hour = one full grid row height)

### 4.2 Positioning

- When dropped, cards snap to the nearest **full hour** boundary (e.g., dropping near 09:40 snaps to 09:00)
- After snapping, the exact start minute can be refined to any value (e.g., `09:17`) via the **inline time editor on the card** or via the **detail popup** — see Sections 4.1 and 5.2
- Cards span vertically based on their duration (e.g., 90 min = 1.5 row heights)
- A card's visual top position within its hour row reflects its true start minute proportionally (e.g., a card starting at 09:17 renders 17/60 = ~28% down within the 09:00 row)
- Cards must not visually overflow their column; if two cards for **different children** overlap in the same day/time slot, display them side-by-side within that column (split the column width)
- **Same-child conflict rule:** Two or more subjects belonging to the same child may **not** occupy the same day and overlapping time range. See Section 6.4 for enforcement details.

### 4.3 Interactions on the Grid

| Action | Behaviour |
|---|---|
| **Drag within grid** | Move card to a new day/time position; snaps to the nearest full hour on drop |
| **Click inline time** | Activates a tiny HH:MM input directly on the card to set an exact start time (any minute, e.g. `11:17`); no popup required |
| **Drag to resize (bottom handle)** | Drag the bottom edge of the card to increase/decrease duration. Minimum: 15 min. Maximum: 5 hours (300 min). Snaps to **15-minute increments** during resize. |
| **Click on card body** | Opens the Routine Entry Detail Popup |
| **Right-click** | Shows a quick context menu: Edit, Duplicate to day(s), Delete |

---

## 5. Routine Entry Detail Popup

Clicking on a grid card opens a modal/popup with full details and edit capabilities.

### 5.1 Header

- Subject icon (large, 32px) + Subject name (heading)
- Close button (X) in top right

### 5.2 Display Fields

| Field | Display |
|---|---|
| **Child(ren)** | Name(s) with avatar initial |
| **Day** | e.g., "Tuesday" |
| **Start time** | HH:MM free input — accepts any minute value (e.g., `11:17`). Updates card position on the grid proportionally within its hour row. |
| **Duration** | Editable number input (minutes), max 300 min (5 hours), min 15 min |
| **Priority** | Dropdown: High / Medium / Low (color-coded) |
| **Subject description** | Read-only short description from the Subject entity |
| **Notes** | Free-text notes field specific to this routine entry (optional) |
| **Frequency** | How many times per week this entry repeats (informational, read from the total placements in the grid) |

### 5.3 Actions in Popup

- **Save** — Apply changes to this specific entry
- **Duplicate to days** — Multi-select checkboxes for Mon–Sun; duplicates this entry to selected days at the same time
- **Delete** — Removes this specific entry from the grid (with confirmation prompt)

---

## 6. Drag and Drop Behaviour

### 6.1 Library

Use **`@dnd-kit/core`** and **`@dnd-kit/sortable`** (already in the Oikos frontend stack or to be installed). These libraries provide accessible, pointer and keyboard drag-and-drop.

### 6.2 Drop Zones

- Every **hour cell** in every day column is a valid drop zone (17 zones per column)
- Drop zones highlight (subtle background glow or border) when a draggable item is hovering over them
- When hovering, a ghost/preview card is shown snapped to the target hour row

### 6.3 Snap & Fine-Tune Behaviour

**Drag snap — coarse (1 hour):**
- Drag-and-drop always snaps to the nearest full hour. This keeps the grid clean and drag interactions fast.

**Inline fine-tune — exact minute:**
- After placing a card, the parent can click the time label on the card to open a small inline HH:MM input. Any minute value is accepted (e.g., `09:17`, `14:52`).
- The same field is available in the detail popup under **Start time**.
- On confirm, the card's visual position shifts proportionally within its hour row to reflect the true start minute. The snap row (hour boundary) does not change — only the offset within it.
- Duration resize snaps to **15-minute increments**.

### 6.4 Overflow / Conflict Handling

**Time overflow:**
- If a dropped card would extend past 22:00, truncate to end at 22:00 and notify the user with a small toast

**Same-child time conflict (blocked):**
- Before placing or moving a card, check whether any entry already on that day overlaps with the proposed time range **for the same child**
- If a conflict is detected, the drop is **rejected**: the card snaps back to its origin and a toast error is shown (e.g., *"Emma already has Mathematics scheduled at this time"*)
- While dragging, drop zones that would cause a same-child conflict should be visually marked as invalid (e.g., red tint, ⛔ cursor) so the parent can see at a glance where placement is allowed
- This rule applies to both drag-from-panel and drag-within-grid operations, and to duration resize (if resizing a card would cause it to overlap another same-child entry, the resize stops at the boundary)

**Multi-child overlap (allowed):**
- Two or more subjects belonging to **different children** may overlap in the same day/time slot — these are displayed side-by-side within the column
- Display a subtle warning badge if more than 2 simultaneous entries exist in a single column slot

---

## 7. Toolbar / Page Header Controls

Located above the planner grid:

| Control | Function |
|---|---|
| **Page title** | "Weekly Routine" |
| **"Add Subject" button** | Opens the curriculum panel if collapsed |
| **"Clear Week" button** | Removes all routine entries (with confirmation modal) |
| **"Duplicate Week" button** | Clones all entries (for future weeks — stores as a template) |
| **Print / Export PDF** | Exports a printable weekly schedule (optional, Phase 2) |
| **Week template selector** | Dropdown listing all saved templates; the currently active template is marked with a ✅ badge. Selecting a different template activates it and deactivates the previous one — **only one template may be active at a time**. |
| **"Set as Active" button** | Shown when viewing a non-active template; promotes it to active and demotes the current active template to a saved template. |
| **"Save as Template" button** | Saves the current state as a named template without activating it. |

---

## 8. Data Model

### 8.1 RoutineEntry (new entity)

```ts
interface RoutineEntry {
  id: string;
  familyId: string;
  childIds: string[];          // one or more children
  subjectId: string | null;    // null for Free Time
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday
  startMinute: number;         // minutes from midnight, e.g. 540 = 09:00
  durationMinutes: number;     // 15–300
  priority: 'high' | 'medium' | 'low';
  notes?: string;
  color?: string;              // hex, inherited from subject if not overridden
  isFreeTime: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 8.2 WeekTemplate (new entity)

```ts
interface WeekTemplate {
  id: string;
  familyId: string;
  name: string;                // e.g., "Term 1 Routine", "Summer Schedule"
  isActive: boolean;           // exactly one template per family must be true
  entries: RoutineEntry[];
  createdAt: string;
  updatedAt: string;
}
```

**Invariant:** At any given time, a family has **at most one** `WeekTemplate` with `isActive: true`. When a template is activated, all other templates for that family must be set to `isActive: false` atomically. The backend must enforce this constraint; the frontend must also prevent the user from activating a template that is already active.

### 8.3 Subject (existing — reference)

The planner reads from the existing `Subject` entity (formerly called "Discipline" in older versions of the spec). It does not modify subjects; it only reads:
- `id`, `name`, `icon`, `color`, `priority`, `description`
- `childIds[]` — which children are enrolled in this subject

---

## 9. State Management

- Use **Zustand** (existing store pattern in Oikos) or React context + `useReducer`
- Local optimistic state: drag operations update local state immediately; API call fires in background
- On error, revert local state and show a toast notification
- Persist planner state to the API on every change (debounced, 500ms)

---

## 10. Accessibility

- All drag-and-drop interactions must have keyboard equivalents (arrow keys to move cards, Enter to drop)
- `@dnd-kit` provides accessible announcements — configure `Announcements` for screen reader support
- All cards must have appropriate `aria-label` (e.g., "Mathematics for Emma, Tuesday 9:00 AM, 45 minutes")
- The detail popup must trap focus and be dismissible with Escape
- Color is never the only indicator of information (priority uses both color + label)

---

## 11. Layout & Responsive Behaviour

The Weekly Planner is a **desktop and tablet web application**. Mobile users are served by the dedicated Oikos mobile app.

| Breakpoint | Behaviour |
|---|---|
| **Desktop (≥1280px)** | Full side-by-side layout: panel on left, grid fills remaining width |
| **Tablet (768–1279px)** | Panel collapses to icon-only strip; click to expand as overlay |

---

## 12. Visual Design Guidelines

- Follow the existing Oikos design system (Tailwind CSS, existing color tokens)
- Grid lines: subtle, light gray (`border-gray-100` in light mode, `border-gray-800` in dark mode)
- Hour row separators are slightly heavier than half-hour rows
- Subject cards use the subject's assigned color for a left border (4px) and a very light tint for the card background
- Priority colors: High = `red-500`, Medium = `amber-400`, Low = `green-500`
- Free Time card: soft green background (`green-50`), 🌿 icon, dashed border
- The current day column has a subtle blue header background
- Card text is always dark (avoid white text on light backgrounds for readability)
- Hover state on drop cells: `bg-primary/10` with a `ring-1 ring-primary` border
- Invalid drop zones (same-child conflict): `bg-red-50` with a `ring-1 ring-red-400` border and ⛔ cursor

---

## 13. Out of Scope (This Spec)

The following are **not** part of this feature and should not be built:

- Actual calendar date assignment (this is a *routine template*, not a scheduled event)
- Lesson completion tracking (handled by the Lesson Journal)
- AI-generated schedule suggestions (Phase 3 feature)
- PDF export of the planner (deferred to Phase 2)
- Notifications or reminders based on routine times
- Multi-week template management UI (data model supports it; UI is future work)
- Mobile layout (handled by the Oikos mobile app)

---

## 14. Acceptance Criteria

- [ ] Parents can view the 7-day × 06:00–22:00 grid with correct hour labels and half-hour guide lines
- [ ] Parents can see draggable subject tiles in the panel, grouped by child
- [ ] Parents can drag a subject tile from the panel to any day/time cell; card snaps to the nearest full hour on drop
- [ ] Dropped cards display subject name, icon, start time, child name, duration, and priority
- [ ] Card height is proportional to duration; card vertical offset within its row reflects its exact start minute
- [ ] Parents can click the time label on a card to enter an exact start time (any HH:MM, e.g. `11:17`) via a tiny inline input
- [ ] Parents can drag an existing grid card to a new position (snaps to full hour)
- [ ] Parents can resize a card by dragging its bottom handle (15-min snap, max 5 hrs)
- [ ] Dropping a subject on a slot that would overlap another entry for the same child is rejected, with a toast error and visual feedback on invalid zones
- [ ] Two subjects for different children may overlap freely and display side-by-side
- [ ] Clicking a card opens the detail popup with all fields
- [ ] Parents can edit start time, duration, priority, and notes in the popup
- [ ] Parents can delete an entry from the popup or via context menu
- [ ] Parents can duplicate an entry to multiple days via the popup (same-child conflict check applies per target day)
- [ ] Free Time tile exists in the panel and behaves identically to subject tiles (no conflict rule)
- [ ] Only one week template can be active at a time; activating a new one deactivates the previous
- [ ] The active template is clearly indicated in the toolbar selector with a ✅ badge
- [ ] Changes persist to the API (optimistic update + background sync)
- [ ] The layout works correctly on desktop and tablet

---

*Oikos — Equipping families to educate with intention.*