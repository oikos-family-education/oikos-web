# Implementation Notes — Group planner subjects by subject (not by child)

Feature: in the Weekly Routine planner subject panel, list each curriculum subject **once** with toggleable child chips, so a shared subject (e.g. Bible Study taught to both kids) is dragged onto the grid as **one** `RoutineEntry` with multiple `child_ids` instead of being duplicated per child.

Scope: pure frontend change. The data model already supports multi-child entries (`RoutineEntry.child_ids` is an `ARRAY`). No API, schema, or migration changes.

## Decisions made beyond the spec

### 1. Eligibility — which subjects show up
A subject appears in the panel if **at least one active child has an active curriculum that contains it** (`is_active = true` on the join row). Same eligibility rule as before, just collapsed across children.

### 2. Default chip selection
When a subject is rendered, **all eligible children are selected by default**. Rationale: the whole point of the redesign is to make "shared session" the default; the user can deselect to create a solo entry. This means a tile that historically only ever appeared under one child (because it's only in that child's curriculum) still has exactly one chip, pre-selected — drag behavior is identical to before.

### 3. Chip selection is panel-scoped, persistent within a session
Selection state lives in the `SubjectPanel` as `Map<subjectId, Set<childId>>`. It persists across re-renders (e.g., when new entries are added) and across drags — so the user can drag the same subject several times without re-clicking chips. It is **not** persisted to the server or `localStorage`; closing the page resets to "all selected."

Tradeoff: a future enhancement could persist last selection per subject in `localStorage`. Skipped to avoid scope creep — the default-all-selected behavior covers the common case.

### 4. Empty-selection guard
If the user deselects every chip on a subject tile, the tile becomes **non-draggable** and visually muted. Rationale: the backend doesn't reject `child_ids: []` for non-free-time entries (verified in [week_planner_service.py](apps/api/app/services/week_planner_service.py)), so creating one would produce an orphan entry that no child's filtered view would surface. Disabling the drag prevents that footgun.

### 5. Entry count badge
Old behavior: badge counted entries for `subject_id` **AND** `child.id IN child_ids`. New behavior: badge counts distinct entries with this `subject_id` (regardless of which children are on them). Rationale: with the per-subject grouping, "how many times this subject is on the grid this week" is the meaningful metric. If the user wants per-child detail, the grid itself shows it.

### 6. Panel header
Renamed from `"Curriculum"` to `"Subjects"`. Rationale: subjects are no longer scoped by child/curriculum visually, so "Subjects" describes what the list is. Added a new i18n key `subjectsHeader` rather than redefining `curriculum` (which is also used elsewhere with the original meaning).

### 7. Sort order
Subjects are sorted alphabetically by `name` (case-insensitive). Previously order was implicit (API list order, grouped per child). Alphabetical is predictable and matches how users mentally scan a list.

### 8. Existing empty-state messages
- `noCurriculum`: shown when **no active child has any active curriculum** (panel-wide, replaces the per-child variant).
- `noSubjectsInCurriculum`: shown when curriculums exist but contain no active subjects.

## Things I had to change

- **`DraggableSubjectTile` key collision**: old keys were `tile-${child.id}-${subject.id}`. New tiles use `tile-${subject.id}` — unique because each subject is rendered once. (Without this, dnd-kit ids would collide if the same subject id appeared multiple times anywhere.)
- **`DragSubjectPayload.childIds`**: payload already supports a string array; no type change required. Just populated with multiple ids now.

## What I did NOT change

- **Backend / schema / API**: untouched.
- **Subject deduplication across curriculums**: still possible to have two `Subject` rows for "Bible Study" (one per curriculum). The new UI **does not** dedupe by name — it dedupes by `subject_id`. If the user actually has two distinct `Subject` rows for the same concept, they will still see two tiles. Fixing that requires the library-picker + merge tool discussed earlier — out of scope for this change.
- **Grid rendering of entries**: untouched. Multi-child entries were already supported.
- **Conflict detection on drag-over**: unchanged. Still uses `dragActive.childIds` which now reflects the selection.

## Open questions for the user

- Should chip selection persist across sessions (per-subject)? Currently it resets when the page is reloaded.
- Should the panel show subjects that exist in the family but are **not** in any active curriculum? Currently it does not — same as before.

## Verification

- `npx tsc --noEmit` against `apps/web`: no new errors. All pre-existing errors (in `components/calendar/CalendarPage.tsx`, `components/settings/ChangePasswordSection.tsx`, `tests/children/ChildCard.test.tsx`, `vitest.config.ts`) are unrelated to this change.
- `npx vitest run`: **60 files / 543 tests passed**. No planner-specific tests exist for `SubjectPanel`, so behavior should be verified manually in a browser.

---

# Follow-up — Global 401 handler (`apiFetch`)

## Why
The "Clear Week button isn't working" report turned out to be an expired session, not a planner bug. The API logs showed `GET /auth/me → 401`, `POST /auth/refresh → 401`, then `DELETE …/entries → 401`. The frontend's `clearWeek` (and many other handlers) just silently no-op on `!res.ok`, so the user saw nothing happen and assumed the button was broken.

Root cause: there was no centralized handling for expired sessions outside `AuthProvider`'s startup handshake. Once the access token expired and silent-refresh failed (because the refresh token also expired), every subsequent API call quietly returned 401 with no UX feedback.

## What changed

### 1. New `apps/web/lib/apiFetch.ts`
A thin wrapper around `fetch` that:
- Defaults `credentials: 'include'`.
- On 401 from any `/api/v1/*` (except `/api/v1/auth/*` itself), does a **single-flight** `POST /api/v1/auth/refresh`, retries the original request once on success, and redirects to `/login` on failure.
- Skips intercepting `/api/v1/auth/*` 401s so the login form can still surface "wrong password" errors.
- Single-flight via a module-scoped `refreshInFlight: Promise<boolean> | null` so concurrent 401s don't trigger multiple refresh calls (which would invalidate each other via the rotate-on-refresh logic).

### 2. Mass migration: 57 files
Every `fetch(...)` call to `/api/v1/*` was converted to `apiFetch(...)`. The migration was scripted in [scripts/migrate-to-apifetch.sh](scripts/migrate-to-apifetch.sh) — one-time use, can be deleted now. It:
- Skipped `providers/AuthProvider.tsx` (owns the auth lifecycle; rerouting its calls through `apiFetch` would create a refresh loop).
- Skipped `tests/` (mock the global `fetch` directly; still pass after the change because `apiFetch` delegates to `fetch` internally).
- Skipped `lib/apiFetch.ts` itself.
- Added the `import { apiFetch } from '<relative path>/lib/apiFetch'` to each file at the position of the first existing import.

### 3. Why AuthProvider is untouched
`AuthProvider` has its own `/me` + manual `/refresh` retry on mount, plus a 50-minute silent-refresh interval. Routing those through `apiFetch` would:
- Cause `apiFetch` to redirect to `/login` on the initial `/me` 401 *before* the AuthProvider's own retry logic could run.
- Recursively call `/refresh` on a `/refresh` 401 (well — guarded by `isAuthEndpoint`, but still odd-looking).

Leaving `AuthProvider` on plain `fetch` keeps the handshake explicit and avoids weird ordering.

## Tradeoffs / risks

- **Hard redirect (`window.location.href = '/login'`)**: this drops any unsaved state on the page. Acceptable for the auth-expired case (the user can't keep working anyway), but if a user has unsaved changes in a form when their token expires, they lose them. Tradeoff accepted for simplicity; a softer prompt could come later.
- **The `apiFetch` wrapper retries silently on 401 → refresh → success**. The user never sees the brief 401 hiccup, which is what we want, but callers can't tell that a refresh happened. Currently no caller needs to.
- **Tests still mock `global.fetch`**. They keep working because `apiFetch` delegates to `fetch`. But the mock pattern in `tests/notes/entityLoader.test.ts` assumes a single `fetch` call per scenario — if a future test simulates a 401, the mock would need to be set up for two calls (original + refresh).
- **Auth components (Login/Register/Forgot/Reset)** were migrated even though they only hit `/api/v1/auth/*`. They effectively behave identically to before, since `apiFetch` short-circuits for auth endpoints. Kept consistent rather than carving out exceptions.

## Verification

- `npx tsc --noEmit`: same 4 pre-existing error files (`CalendarPage.tsx`, `ChangePasswordSection.tsx`, `ChildCard.test.tsx`, `vitest.config.ts`), no new errors.
- `npx vitest run`: **60 files / 543 tests passed**.
- Manual: the user should now log out + log back in for the immediate session, and going forward token expiration will silently refresh in the background; if both tokens expire, the next API call triggers a clean redirect to `/login` instead of a silent no-op.

---

# Follow-up — Drag overlay rendered icon name as text

## Why
The `DragOverlay` in [planner/page.tsx](apps/web/app/[locale]/(dashboard)/planner/page.tsx) was rendering `dragActive.icon` directly inside a `<span>`. For subjects, `icon` is a Lucide component name string (e.g. `"BookOpen"`), so dragging surfaced the literal text `BookOpen` next to the subject name. Custom activities passed an emoji string, which displayed correctly by accident.

## Fix
Mirrored the same pattern used by `SubjectIcon` in `SubjectPanel.tsx`: if the icon string is a key in `lucide-react`'s `icons` export, render the corresponding component; otherwise treat it as an emoji/text. Inlined rather than extracting a shared component since it's a one-line check used in two places, and extraction would mean a new file + import.

---

# Follow-up — 30-minute drop granularity

## Why
Drops on the week grid only snapped to the full hour. Users want 30-minute precision.

## What changed
- [PlannerGrid.tsx](apps/web/components/planner/PlannerGrid.tsx) — replaced the single `HourCell` droppable per hour with two stacked `HalfHourCell` droppables (top = `:00`, bottom = `:30`), each half the row height. Droppable id is now `cell-${dayIndex}-${hour}-${minute}` and droppable data carries `minute: 0 | 30`. The mid-hour visual divider is now an organic consequence of the half-cell border, instead of an extra absolutely-positioned `<div>`.
- [planner/page.tsx](apps/web/app/[locale]/(dashboard)/planner/page.tsx) — `handleDragEnd` reads `minute` from drop data with a default of `0` (for safety), then `startMinute = hour * 60 + minute`. Conflict detection iterates `[0, 30]` per hour and keys the set with the minute.

## Tradeoff
- Conflict-detection now runs 2× the inner loop, but the loop body is cheap (one `.some()` per slot) and only runs while dragging.
- Half-hour cells still respect the existing clamp logic (template `start_hour` and `end_hour`). Dropping in the very last `:30` slot of the last hour can still trigger the existing "entry truncated to end at HH:00" toast, same behavior as before for late starts.

---

## Manual test checklist

1. **Shared subject**: a subject in two children's curriculums shows **one tile** with two chips (both selected). Drag → grid renders one entry tagged with both children. ✅ expected.
2. **Solo override**: deselect one chip on a shared subject. Drag → grid renders an entry with only the remaining child. ✅ expected.
3. **All chips off**: deselect every chip. The tile shows muted styling and cannot be dragged. ✅ expected.
4. **Single-child subject**: a subject in only one curriculum still renders with one chip (pre-selected). Drag works the same as before. ✅ expected.
5. **Empty states**: no active curriculum → "no curriculum" message. Curriculum present but no subjects → "no subjects" message.
6. **Conflict feedback**: dragging a shared subject onto a slot already occupied by either child should still show the red conflict cell (uses `dragActive.childIds`).
