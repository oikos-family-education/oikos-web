# Testing Plan

This document describes how test coverage is measured and the roadmap for
bringing every part of the codebase under automated test.

The codebase is a Turborepo monorepo with two runtimes that need separate
toolchains:

- `apps/api` — Python / FastAPI tested with **pytest** + **pytest-cov**.
- `apps/web` — TypeScript / Next.js tested with **Vitest** + **@vitest/coverage-v8**.

The shared packages (`packages/ui`, `packages/types`, `packages/config`) are
tested through their consumers in `apps/web`.

---

## 1. Coverage tooling

### 1.1 API (Python)

- `pytest-cov` is added to `apps/api/requirements.txt`.
- Configuration lives in [`apps/api/pyproject.toml`](../apps/api/pyproject.toml)
  under `[tool.coverage.*]`. It enables branch coverage, sources `app/`, omits
  seeds, and emits HTML to `htmlcov/`.
- Run from `apps/api`:
  ```bash
  pytest --cov                       # terminal report
  pytest --cov --cov-report=html     # writes htmlcov/index.html
  pytest --cov --cov-report=xml      # writes coverage.xml (for CI tooling)
  ```
- Tests use a real PostgreSQL via `tests/conftest.py`, so coverage runs
  require either Docker (`docker compose up -d db redis`) or a host-local DB
  matching `DATABASE_URL`.

### 1.2 Web (TypeScript)

- `@vitest/coverage-v8` is added to `apps/web/package.json` devDependencies.
- Configuration lives in [`apps/web/vitest.config.ts`](../apps/web/vitest.config.ts)
  under `test.coverage`. It uses the V8 provider and writes `text`, `html`,
  and `lcov` reports to `apps/web/coverage/`.
- Scripts in `apps/web/package.json`:
  - `npm run test` — single-run unit tests.
  - `npm run test:watch` — watch mode for local development.
  - `npm run test:coverage` — single-run with coverage report.

### 1.3 Monorepo

- `turbo.json` exposes a `test:coverage` task with `coverage/**` and
  `htmlcov/**` declared as outputs (so Turborepo caches them).
- `package.json` (root) exposes `npm run test:coverage`, which runs
  `test:coverage` across all workspaces. The API isn't a JS workspace, so its
  coverage must be run from `apps/api` directly.

### 1.4 CI integration (recommended)

Add a `coverage` job to GitHub Actions that:

1. Spins up Postgres + Redis services (use the existing `docker-compose.yml`).
2. Runs `pytest --cov --cov-report=xml` from `apps/api`.
3. Runs `npm run test:coverage` from the repo root.
4. Uploads `apps/api/coverage.xml` and `apps/web/coverage/lcov.info` to
   Codecov (or fails on a configurable threshold via
   `--cov-fail-under=N` / Vitest `coverage.thresholds`).

Suggested initial thresholds (raise as suites fill in):

| Layer       | Lines | Branches |
|-------------|-------|----------|
| API services | 80%  | 70%      |
| API routers  | 70%  | 60%      |
| Web hooks    | 80%  | 70%      |
| Web pages    | 50%  | 40%      |

---

## 2. Current state

- API: only `tests/test_auth.py` (register/login/forgot-password happy paths).
- Web: `tests/auth.test.ts` is a placeholder dummy spec.
- Coverage today is effectively single-digit percent across both apps.

The plan below is ordered roughly by risk × surface area.

---

## 3. API — test plan (`apps/api`)

### 3.1 Test architecture

Two test styles, used together:

- **Service tests** (`tests/services/test_<feature>_service.py`) — instantiate
  the service with the test `AsyncSession` fixture and exercise the business
  logic directly. Fast, easy to cover edge cases.
- **Router/integration tests** (`tests/routers/test_<feature>.py`) — drive the
  ASGI app through the existing `client` fixture in `conftest.py`. Cover
  authentication, status codes, schema serialization, and route wiring.

Reusable fixtures to add to `conftest.py`:

- `authed_client` — a client with a registered user and valid `access_token`
  cookie set. Yields `(client, user)` so tests can assert ownership.
- `family_factory(db, user)` — creates a `Family` and `FamilyMember` row.
- `child_factory(db, family, **overrides)`, `subject_factory`,
  `curriculum_factory`, `project_factory`, `resource_factory`,
  `note_factory`, `calendar_event_factory`, `week_planner_factory`,
  `teaching_log_factory`. Factories let tests create deeply linked rows
  without copy-pasting setup.
- `mock_redis` — generalize the per-test pattern in `test_auth.py` into an
  autouse fixture so any test that hits rate-limited endpoints works.

### 3.2 Per-feature coverage

#### Authentication (`auth_service`, `routers/auth`, `core/security`)
Already partially covered. Fill the gaps:

- `POST /auth/register`: invalid email format, password mismatch,
  password too short, `agreed_to_terms=False`, missing fields → 422.
- `POST /auth/login`: unknown email → 401; rate-limit 429; account
  locked 423 (mock the Redis lockout state).
- `POST /auth/refresh`: valid refresh cookie → new access cookie;
  expired/missing refresh cookie → 401.
- `POST /auth/logout`: clears both cookies.
- `GET /auth/me`: returns `has_family` flag accurately for users with and
  without a `FamilyMember` row.
- `POST /auth/forgot-password`: returns 200 even for unknown email
  (no user enumeration); creates a hashed reset token row.
- `POST /auth/reset-password`: valid token → password updated, token
  consumed; expired token → 400; invalid token → 400.
- `core/security.create_access_token` / `decode_token`: round-trip,
  expired token, tampered signature, missing `sub` claim.
- `get_current_user` dependency: missing cookie, malformed JWT, user
  deleted after issuance (foreign key cleanup) → 401.

#### Families & invitations (`family_service`, `family_members_service`, routers)

- Create family: sets the creator as admin/owner.
- List families for current user: returns only families they belong to.
- Update family fields, delete family (cascades to members, children, etc.).
- Add/remove family members; permissions — non-admin cannot remove others.
- Invitation flow:
  - Create invitation → row with token, expiry, email.
  - Accept invitation while logged in → membership row created.
  - Accept invitation as new user → registration + membership.
  - Decline / expired / already-accepted → 400/410.
  - Permissions: only admins of the family can invite.

#### Children (`routers/families` for /children, models/child)

Coverage of the children endpoints (current location to be confirmed —
wire if missing):

- Create child within a family: sets `family_id`, validates name and DOB.
- Update / delete child cascades to teaching logs and progress entries.
- List children: scoped to current user's families only.
- Authorization: cannot read or mutate a child in someone else's family.

#### Subjects (`subject_service`, `routers/subjects`)

- Create subject (per family or per child — confirm scoping).
- List, get, update, delete subject; soft-delete vs hard-delete behavior.
- Default seeded subjects: a service test that runs the seed and asserts
  the expected list exists.
- Validation: required fields, color/icon enum if present.

#### Curriculums (`curriculum_service`, `routers/curriculums`)

- Create curriculum linked to a subject + child.
- Update curriculum fields and the order of items if curricula contain
  ordered items.
- Delete curriculum cascades to its items.
- List curriculums by child / subject.
- Authorization: can only see curricula of children in your family.

#### Week planner (`week_planner_service`, `routers/week_planner`)

- Create planner entry for a given ISO week.
- List entries for a child + week range.
- Update an entry (drag-and-drop reorder, time change).
- Delete entry.
- Edge cases: overlapping entries, week boundaries (Sunday vs Monday),
  invalid week numbers.

#### Projects (`project_service`, `routers/projects`)

- Create / update / delete project.
- Project status transitions (e.g., draft → in-progress → completed) —
  any disallowed transitions should 400.
- Certificate generation endpoint: only allowed for completed projects.
- Project ↔ subject / curriculum linkage.
- Listing projects: filter by status, child, subject; pagination if any.

#### Resources (`resource_service`, `routers/resources`)

- Create resource with category (book / video / link / etc.).
- Update / delete resource.
- Listing with filters (category, child).
- URL validation for external links.

#### Calendar (`calendar_service`, `routers/calendar`)

- Create event (one-off and recurring if recurrence is supported).
- Update event details and recurrence.
- Delete event (single occurrence vs whole series, if applicable).
- Range query: events within a date window for the family.
- Authorization: same family-scoped rules.

#### Progress (`progress_service`, `routers/progress`)

- Log a teaching event / progress entry against a child + subject.
- Aggregations used by the dashboard widget:
  - `useProgressSummary` data — totals per subject/child/week.
  - `useProgressReport` data — weekly breakdown.
- Edge cases: empty data set, dates spanning month/year boundaries,
  timezone correctness (entries logged at midnight UTC vs local).

#### Notes (`note_service`, `routers/notes`)

- Create note (with tags, optional child/subject linkage).
- Update / delete note.
- Search / filter notes by tag, by linked entity.
- Authorization: only the author / family members can read.

#### Cross-cutting

- `core/config.py`: settings load from env, sane defaults, missing
  required env raises.
- `core/database.py`: `get_db` yields a session and closes it on exit
  (smoke-test via dependency override).
- `main.py`: `/health` returns ok; CORS headers present on a sample
  request; the validation exception handler returns 422 with `detail`.
- Schemas: a small parametric test that round-trips each Pydantic schema
  through `model_dump` / `model_validate` to catch breakages from model
  drift.
- Models: a single test that imports every model module, so an
  alembic-vs-model mismatch is caught even before integration tests run.

### 3.3 Out-of-suite checks

- An Alembic test that runs all migrations from `base` to `head` and back
  to `base` against a clean DB. Catches downgrade bugs and squash issues.
  (Lives in `tests/test_alembic.py`, marked `@pytest.mark.slow`.)

---

## 4. Web — test plan (`apps/web`)

### 4.1 Test architecture

Three test styles:

- **Pure unit tests** — `lib/`, `hooks/`, validation schemas. Plain Vitest;
  no DOM needed for non-hook helpers.
- **Component tests** — `@testing-library/react` + jsdom. Render, query,
  fire events, assert.
- **Page-level tests** — render a page with `next-intl` provider + mocked
  `next/navigation` + mocked `fetch`, then drive the form/UI.

Test infrastructure to add:

- `tests/setup.ts` (referenced via `vitest.config.ts` `setupFiles`):
  - `@testing-library/jest-dom` matchers.
  - Reset `fetch` mocks between tests.
  - Polyfill `ResizeObserver`, `matchMedia` if required by `@dnd-kit`.
- `tests/utils/renderWithProviders.tsx`: wraps a node with
  `NextIntlClientProvider`, a stub `AuthProvider`, and `MemoryRouterProvider`.
- `tests/utils/mockFetch.ts`: registers JSON-returning handlers per URL,
  asserts `credentials: 'include'`, surfaces unmocked URLs as failures.
- Optional: introduce **MSW** to handle `/api/v1/*` requests at the network
  layer. Cleaner than per-test `vi.fn()` mocks once we have ≥10 fetches
  to mock.

### 4.2 Shared / library coverage

- `lib/categoryLabel.ts` — every category enum maps to a translated label.
- `lib/getServiceMeta.tsx` — known services return correct icon + label;
  unknown service returns a sensible fallback.
- `lib/navigation.ts` — every route in the nav tree is reachable; active
  state matches the current pathname; permission gating works.
- `middleware.ts` — protected paths without `access_token` redirect to
  `/login`; auth paths with `access_token` redirect to `/dashboard`;
  locale prefix is preserved.
- `i18n.ts` — locale loader returns a messages object; unknown locale
  falls back to `en`.

### 4.3 Hooks

- `hooks/useProgressReport.ts`:
  - Fetches with `credentials: 'include'`.
  - Returns `{ loading, error, data }` lifecycle.
  - Refetches when params change; aborts on unmount.
  - Surfaces 401 by clearing data (or whatever the contract is).
- `hooks/useProgressSummary.ts` — same checklist.

### 4.4 Providers

- `providers/AuthProvider.tsx`:
  - Fetches `/api/v1/auth/me` on mount; sets user + family.
  - Redirects to `/login` on 401.
  - Redirects to `/onboarding/family` when `user.has_family === false`.
  - `logout()` clears cookies and redirects.
  - Re-fetches on window focus if implemented.

### 4.5 Shared UI (`packages/ui`)

- `Button.tsx`: renders `inline-flex items-center justify-center
  whitespace-nowrap`; `disabled` blocks click; `type` prop respected.
- `Input.tsx`: `required` renders the red asterisk; `error` prop renders
  inline error text and red border; label `htmlFor` matches input `id`.

### 4.6 Auth components & pages (`components/auth`, `app/[locale]/(auth)`)

- Login page:
  - Empty submit shows validation errors per the Zod schema.
  - Successful submit posts to `/api/v1/auth/login` with
    `credentials: 'include'`, then routes to `/dashboard`.
  - 401 → "invalid credentials" alert.
  - 423 → "account locked" alert.
  - 429 → "too many attempts" alert.
- Register page: every field renders an asterisk when required; password
  strength meter updates; submit creates user and routes onward.
- Forgot-password / reset-password: success and failure states; token
  validation.

### 4.7 Onboarding (`components/onboarding`, `app/[locale]/onboarding/*`)

- `family/page.tsx`: creates a family, sets the user as member, then
  routes to `/onboarding/children`.
- `coat-of-arms/page.tsx`: image picker, persists choice.
- `children/page.tsx`: add multiple children; submit creates them all.
- Middleware redirect: a logged-in user with `has_family=false` arriving
  at `/dashboard` is bounced to `/onboarding/family` (covered by
  AuthProvider tests above).

### 4.8 Dashboard (`components/dashboard`, `app/[locale]/(dashboard)/dashboard`)

The new dashboard pieces (ActiveCurriculums, OngoingProjects,
NeglectedSubjects, RecentCertificates, TodaySchedule, ProgressWidget,
DashboardJournal, DashboardNotes, DashboardHero) are the highest-churn
area and the most user-visible. They each deserve a component test:

- Renders an empty state when the API returns `[]`.
- Renders a populated list with correct counts/links.
- Loading state shows a skeleton/loader.
- Error state shows the error component.
- Quick-action modals (`QuickEventModal`, `QuickNoteModal`,
  `QuickProgressModal`):
  - Open / close via the trigger.
  - Submit posts to the right endpoint and closes on success.
  - Validation errors displayed inline.
- `Sidebar.tsx` + `SidebarNavItem.tsx`: collapsed-state preference is
  read/written to `localStorage`; active item gets the active classes;
  keyboard nav works.

### 4.9 Feature pages

For each feature page, the minimum bar is:

1. Renders without crashing under the providers.
2. Loading and empty states.
3. Lists items returned by a mocked fetch.
4. Create flow: form validation, submit, optimistic UI, error handling.
5. Update flow: prefilled form, submit, success message.
6. Delete flow: confirm dialog, optimistic removal, error rollback.

Pages to cover, grouped by complexity:

| Feature      | Components dir              | Page route                                           |
|--------------|-----------------------------|------------------------------------------------------|
| Children     | `components/children`       | `(dashboard)/children`, `[child_id]`                 |
| Family       | `components/family`         | `(dashboard)/family` (incl. `tabs/` subcomponents)   |
| Subjects     | `components/subjects`       | `(dashboard)/subjects/*`                             |
| Curriculums  | `components/curriculums`    | `(dashboard)/curriculums/*`                          |
| Week planner | `components/planner`        | `(dashboard)/planner` (drag-and-drop is the risk)    |
| Projects     | `components/progress` + `dashboard` | `(dashboard)/projects/*` (incl. `/certificate`) |
| Resources    | `components/resources`      | `(dashboard)/resources/*`                            |
| Calendar     | `components/calendar`       | `(dashboard)/calendar`                               |
| Progress     | `components/progress`       | `(dashboard)/progress`, `/report`                    |
| Notes        | `components/notes`          | `(dashboard)/notes`                                  |

`@dnd-kit` interactions are the single trickiest area. Test the planner
reorder logic by extracting the array-mutation function and unit-testing
that, rather than driving the DnD events through jsdom.

### 4.10 i18n

- A test that loads `messages/en.json` and verifies every namespace key
  used in code via `useTranslations('Foo').t('bar')` exists in the file.
  This can be a static AST scan; once written it pays for itself every
  time someone forgets to add a translation.

---

## 5. End-to-end tests (out of scope, recommended later)

Once unit + component coverage is stable, layer Playwright E2E tests for
a small set of golden-path flows:

1. Register → create family → add child → see dashboard.
2. Create subject → curriculum → log progress → see in dashboard widget.
3. Create project → mark complete → download certificate.
4. Send invitation → accept as new user → land in family.

Run them in a separate `tests:e2e` task against a Docker Compose stack.
Don't include E2E coverage in the unit-test thresholds.

---

## 6. Roadmap

**Phase 1 — infrastructure (1–2 days).** Wire up the fixtures (`authed_client`,
factories) on the API side and the providers/MSW helpers on the web side.
Convert `tests/auth.test.ts` from a dummy to a real Login form test as the
template for everyone else.

**Phase 2 — auth + family + children (1 week).** These are the gates to the
rest of the app. Bring API services to ≥80%, web pages to ≥60%.

**Phase 3 — feature breadth (2–3 weeks).** Walk down §3.2 / §4.9 in order of
business risk: progress + projects (data integrity), then planner (UX
complexity), then notes / calendar / resources / curriculums.

**Phase 4 — quality bar.** Turn on `--cov-fail-under` in CI at the
thresholds in §1.4 and ratchet upward as suites grow.
