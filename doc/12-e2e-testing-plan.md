# End-to-End (E2E) Testing Plan

This document covers the strategy for browser-level end-to-end tests — a distinct
tier from the unit and component tests in `doc/11-testing-plan.md`.

---

## 1. What kind of test is this?

The tests described here are **End-to-End (E2E) tests** (also called *browser tests*
or *acceptance tests*). Unlike the existing 515 Vitest + jsdom tests, which render
React components in a simulated browser environment with mocked APIs, E2E tests:

- Launch a **real browser** (Chromium/Firefox/WebKit).
- Load the **live Next.js app** at `http://localhost:3000`.
- Drive it through **real HTTP requests** to the **live FastAPI backend**.
- Assert on what a user actually sees in the rendered page.

This means E2E tests catch an entirely different class of bug: API contract
mismatches, cookie handling, SSR/hydration issues, Alembic migration drift,
race conditions in async operations, and real network timing.

### Do these tests already exist?

No. Every file in `apps/web/tests/` is a Vitest component test that runs in
Node.js with jsdom and `vi.stubGlobal('fetch', …)`. There is no Playwright or
Cypress config anywhere in the repository. The existing testing plan (`doc/11-testing-plan.md`
§5) lists E2E as "out of scope, recommended later" with four bullet-point stubs.
This document fills in that section.

---

## 2. Framework: Playwright

**Recommendation: [@playwright/test](https://playwright.dev/)**

Playwright is the best-fit for this stack because:

| Criterion | Playwright | Cypress |
|-----------|-----------|---------|
| TypeScript-native | ✅ First-class | ✅ Supported |
| Next.js 14 App Router | ✅ Works out of the box | ⚠️ Requires workarounds for RSC |
| httpOnly cookie handling | ✅ Full control via `storageState` | ⚠️ Cannot read httpOnly cookies |
| Parallel test isolation | ✅ Worker-per-test via `workerIndex` | ⚠️ Paid plan for parallelism |
| Network interception | ✅ `page.route()` | ✅ `cy.intercept()` |
| CI Docker integration | ✅ Built-in image | ⚠️ Manual setup |
| `storageState` (saved auth) | ✅ Core feature | ❌ Not built in |

The httpOnly cookie requirement is the deciding factor: Oikos uses `access_token`
and `refresh_token` httpOnly cookies. Playwright can inject, persist, and inspect
these via `BrowserContext.storageState()`.

---

## 3. Test environment

E2E tests run against a **separate Docker Compose stack** — never the production
database and never the same database the unit tests use.

### 3.1 Docker Compose override

Create `docker-compose.e2e.yml` at the repo root:

```yaml
# docker-compose.e2e.yml
# Brings up a fully isolated stack for E2E tests.
# Usage: docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d

services:
  db:
    environment:
      POSTGRES_DB: oikos_e2e   # isolated database — never shared with dev

  api:
    environment:
      DATABASE_URL: postgresql+asyncpg://oikos:oikos@db:5432/oikos_e2e
      DATABASE_SYNC_URL: postgresql://oikos:oikos@db:5432/oikos_e2e
      E2E_SEED_SECRET: ${E2E_SEED_SECRET:-e2e-local-secret}
    ports:
      - "8001:8000"   # avoid colliding with the dev API on 8000

  web:
    environment:
      NEXT_PUBLIC_API_URL: http://api:8001
    ports:
      - "3001:3000"   # avoid colliding with the dev frontend on 3000
```

### 3.2 E2E environment file

`apps/web/.env.e2e`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8001
E2E_BASE_URL=http://localhost:3001
E2E_SEED_SECRET=e2e-local-secret
```

This file is **never committed**. Add `*.e2e` to `.gitignore` and document the
variables in `.env.example`.

---

## 4. Test account strategy

The core problem: E2E tests need a known, deterministic dataset in the database
before each suite runs. The solution is a **seed API endpoint** that is only
available when `E2E_SEED_SECRET` is set.

### 4.1 FastAPI seed endpoint

Add a router `apps/api/app/routers/e2e_seed.py` (only mounted when env var is present):

```python
# apps/api/app/routers/e2e_seed.py
"""
E2E test seeding endpoint — only mounted when E2E_SEED_SECRET is set.
Never ship this router in a production image.
"""
import os
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.e2e_seed_service import seed_e2e_data, reset_e2e_data

router = APIRouter(prefix="/api/v1/e2e", tags=["e2e"])
SECRET = os.getenv("E2E_SEED_SECRET", "")


def _require_secret(x_e2e_secret: str = Header(...)):
    if not SECRET or x_e2e_secret != SECRET:
        raise HTTPException(status_code=403, detail="forbidden")


@router.post("/seed", dependencies=[Depends(_require_secret)])
async def seed(db: AsyncSession = Depends(get_db)):
    """Drop all data and create the standard E2E fixture dataset."""
    result = await seed_e2e_data(db)
    return result   # returns credentials + IDs the tests need


@router.post("/reset", dependencies=[Depends(_require_secret)])
async def reset(db: AsyncSession = Depends(get_db)):
    """Truncate all tables and re-seed. Idempotent."""
    await reset_e2e_data(db)
    return {"ok": True}
```

Register it in `app/main.py` only when the env var is present:

```python
if os.getenv("E2E_SEED_SECRET"):
    from app.routers.e2e_seed import router as e2e_router
    app.include_router(e2e_router)
```

### 4.2 Seed service

`apps/api/app/services/e2e_seed_service.py` creates a **fixed, named dataset**
that every test can reason about:

```python
async def seed_e2e_data(db: AsyncSession) -> dict:
    # 1. Truncate all tables (reuse TRUNCATE_TABLES_SQL from conftest)
    await db.execute(text(TRUNCATE_TABLES_SQL))
    await db.commit()

    # 2. Create test user
    user = User(email="e2e@oikos.test", first_name="E2E", last_name="Tester",
                hashed_password=get_password_hash("E2ePassword1!"))
    db.add(user)
    await db.flush()

    # 3. Create family
    family = Family(account_id=user.id, family_name="E2E Family",
                    family_name_slug="e2e-family", ...)
    db.add(family)
    await db.flush()
    db.add(FamilyMember(family_id=family.id, user_id=user.id, role="primary"))
    user.has_family = True

    # 4. Create children
    alice = Child(family_id=family.id, first_name="Alice", ...)
    bob   = Child(family_id=family.id, first_name="Bob", ...)
    db.add_all([alice, bob])
    await db.flush()

    # 5. Create subjects (some active, one inactive)
    math    = Subject(family_id=family.id, name="Mathematics", is_active=True, ...)
    science = Subject(family_id=family.id, name="Science",     is_active=True, ...)
    history = Subject(family_id=family.id, name="History",     is_active=False, ...)
    db.add_all([math, science, history])
    await db.flush()

    # 6. Create curriculums (active ones attached to Alice)
    curr_math    = Curriculum(child_id=alice.id, subject_id=math.id,    is_active=True,  ...)
    curr_science = Curriculum(child_id=alice.id, subject_id=science.id, is_active=True,  ...)
    curr_history = Curriculum(child_id=alice.id, subject_id=history.id, is_active=False, ...)
    db.add_all([curr_math, curr_science, curr_history])

    # 7. Create projects, notes, calendar events, teaching logs … as needed
    # …

    await db.commit()

    return {
        "user":   {"email": "e2e@oikos.test", "password": "E2ePassword1!"},
        "family": {"id": str(family.id), "name": "E2E Family"},
        "children": {
            "alice": {"id": str(alice.id), "name": "Alice"},
            "bob":   {"id": str(bob.id),   "name": "Bob"},
        },
        "subjects": {
            "math":    {"id": str(math.id),    "active": True},
            "science": {"id": str(science.id), "active": True},
            "history": {"id": str(history.id), "active": False},
        },
        "curriculums": {
            "math":    {"id": str(curr_math.id),    "active": True},
            "science": {"id": str(curr_science.id), "active": True},
            "history": {"id": str(curr_history.id), "active": False},
        },
    }
```

The returned object becomes the **fixture manifest** — tests query it instead of
hardcoding IDs.

### 4.3 Playwright global setup

`apps/web/e2e/global-setup.ts` runs once before the entire suite:

```typescript
// apps/web/e2e/global-setup.ts
import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001';
const SECRET = process.env.E2E_SEED_SECRET ?? 'e2e-local-secret';
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

export default async function globalSetup(_config: FullConfig) {
  // 1. Seed the database via the API endpoint
  const seedRes = await fetch(`${API}/api/v1/e2e/seed`, {
    method: 'POST',
    headers: { 'x-e2e-secret': SECRET },
  });
  if (!seedRes.ok) throw new Error(`Seed failed: ${seedRes.status}`);
  const fixtures = await seedRes.json();

  // Persist fixture manifest for tests to read
  fs.writeFileSync('e2e/.fixtures.json', JSON.stringify(fixtures, null, 2));

  // 2. Log in once, capture the auth cookies, save storage state
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page    = await context.newPage();

  await page.goto(`${BASE}/en/login`);
  await page.getByLabel(/email/i).fill(fixtures.user.email);
  await page.getByLabel(/password/i).fill(fixtures.user.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard');

  // storageState captures the httpOnly cookies Playwright set during login
  await context.storageState({ path: 'e2e/.auth.json' });
  await browser.close();
}
```

`apps/web/e2e/global-teardown.ts` runs once after the suite:

```typescript
import * as fs from 'fs';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001';
const SECRET = process.env.E2E_SEED_SECRET ?? 'e2e-local-secret';

export default async function globalTeardown() {
  await fetch(`${API}/api/v1/e2e/reset`, {
    method: 'POST',
    headers: { 'x-e2e-secret': SECRET },
  });
  fs.rmSync('e2e/.fixtures.json', { force: true });
  fs.rmSync('e2e/.auth.json',     { force: true });
}
```

### 4.4 Playwright config

`apps/web/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:        './e2e',
  globalSetup:    './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel:  true,
  retries:        process.env.CI ? 2 : 0,
  workers:        process.env.CI ? 2 : undefined,
  reporter:       process.env.CI ? 'github' : 'html',
  timeout:        30_000,

  use: {
    baseURL:      process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    // All tests that need auth reuse the saved state — no re-login per test
    storageState: 'e2e/.auth.json',
    trace:        'on-first-retry',
    screenshot:   'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Add firefox / webkit in CI for cross-browser coverage
  ],

  webServer: {
    // Optional: let Playwright start the Next.js dev server automatically
    // Remove this if you prefer to start the stack manually before running tests.
    command:  'npm run dev',
    url:      'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 4.5 Test isolation

The global seed runs **once** per suite invocation (not once per test). For tests
that mutate data (create an event, delete a curriculum, etc.), two isolation
strategies apply:

| Strategy | When to use | How |
|----------|-------------|-----|
| **Read-only assertions** | Most dashboard/listing tests | Just read; the fixture is shared and never mutated |
| **Per-test reset** | Tests that write/delete data | Call `POST /api/v1/e2e/reset` in `test.beforeEach` via Playwright's `request` fixture |

```typescript
// In a write-heavy test file:
test.beforeEach(async ({ request }) => {
  await request.post('/api/v1/e2e/reset', {
    headers: { 'x-e2e-secret': process.env.E2E_SEED_SECRET! },
  });
});
```

---

## 5. Test structure and helpers

```
apps/web/
  e2e/
    global-setup.ts
    global-teardown.ts
    fixtures.ts           ← shared Page Object helpers
    dashboard/
      active-curriculums.spec.ts
      today-schedule.spec.ts
      progress-widget.spec.ts
    auth/
      login.spec.ts
      register.spec.ts
    onboarding/
      family-setup.spec.ts
    children/
      add-child.spec.ts
    calendar/
      create-event.spec.ts
    notes/
      create-note.spec.ts
    projects/
      complete-project.spec.ts
```

### 5.1 Shared fixtures helper

`apps/web/e2e/fixtures.ts` exposes the fixture manifest and typed Page Objects:

```typescript
import { test as base } from '@playwright/test';
import * as fs from 'fs';

type Fixtures = { fixtureData: ReturnType<typeof loadFixtures> };

function loadFixtures() {
  return JSON.parse(fs.readFileSync('e2e/.fixtures.json', 'utf8'));
}

export const test = base.extend<Fixtures>({
  fixtureData: async ({}, use) => {
    await use(loadFixtures());
  },
});

export { expect } from '@playwright/test';
```

Tests import `{ test, expect }` from `./fixtures` instead of `@playwright/test`.

---

## 6. Concrete example: active curriculums on dashboard

This is the scenario described in the user's request: log in → navigate to
dashboard → assert that the curriculum section shows only the active curriculums.

`apps/web/e2e/dashboard/active-curriculums.spec.ts`:

```typescript
import { test, expect } from '../fixtures';

test.describe('Dashboard — Active Curriculums widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('shows only active curriculums for each child', async ({ page, fixtureData }) => {
    const { subjects } = fixtureData;

    // The widget heading is visible
    await expect(page.getByRole('heading', { name: /active curriculums/i })).toBeVisible();

    // Active subjects appear
    await expect(page.getByText(subjects.math.name    ?? 'Mathematics')).toBeVisible();
    await expect(page.getByText(subjects.science.name ?? 'Science')).toBeVisible();

    // Inactive subject does NOT appear
    await expect(page.getByText(subjects.history.name ?? 'History')).not.toBeVisible();
  });

  test('curriculum count matches the API', async ({ page, request, fixtureData }) => {
    // Fetch active curriculums from the API directly to verify the UI matches
    const res = await request.get('/api/v1/curriculums?is_active=true', {
      headers: { Cookie: `access_token=${/* reuse from storageState */}` },
    });
    const { items } = await res.json();

    const widget = page.locator('[data-testid="active-curriculums-widget"]');
    const rows   = await widget.locator('[data-testid="curriculum-row"]').count();
    expect(rows).toBe(items.length);
  });

  test('shows empty state when no curriculums are active', async ({ page, request }) => {
    // Reset and seed a family with no active curriculums
    await request.post('/api/v1/e2e/reset', {
      headers: { 'x-e2e-secret': process.env.E2E_SEED_SECRET! },
    });

    await page.goto('/en/dashboard');
    await expect(page.getByText(/no active curriculums/i)).toBeVisible();
  });
});
```

> **Note:** The component selectors (`data-testid="active-curriculums-widget"`) need
> to be added to the production component as part of implementing the test. Use
> `data-testid` attributes for E2E targeting — never rely on CSS classes or text
> that changes with locale.

---

## 7. Golden-path test scenarios

These are the highest-value flows to implement first, ordered by risk:

### 7.1 Authentication

| Test | Asserts |
|------|---------|
| Login with valid credentials | Redirects to `/dashboard`, user name visible |
| Login with wrong password | "Invalid credentials" error visible |
| Too many attempts | "Too many attempts" / rate-limit message |
| Register a new user | Account created, redirected to `/onboarding/family` |
| Forgot password + reset | Success email shown, reset form accepts token |
| Logout | Redirects to `/login`, protected page inaccessible |

### 7.2 Onboarding

| Test | Asserts |
|------|---------|
| Create family (all steps) | Family visible in sidebar, `/dashboard` accessible |
| Add child | Child appears in children list |
| Choose coat of arms | Shield visible in DashboardHero |

### 7.3 Dashboard widgets

| Test | Asserts |
|------|---------|
| Active curriculums | Only `is_active=true` items shown (compare vs API) |
| Today's schedule | Events seeded for today appear in order |
| Ongoing projects | Overdue label for past `due_date` |
| Neglected subjects | Subject with oldest `last_logged` appears first |
| Progress widget | This-week streak count matches teaching log count |

### 7.4 Core CRUD flows

| Test | Asserts |
|------|---------|
| Create subject | Appears in subjects list |
| Create curriculum | Appears under child's curriculum list |
| Log progress | Counter increments in Progress widget |
| Create calendar event | Event appears on the calendar |
| Create note | Note visible in Notes board |
| Create project → complete → certificate | Certificate downloadable |
| Send family invitation → accept | Invitee appears as family member |

---

## 8. `data-testid` attribute convention

E2E tests are brittle when they rely on text content (which changes with locale)
or CSS classes (which change with refactors). Add `data-testid` attributes to
the key containers and interactive elements in each component:

```tsx
// In ActiveCurriculums.tsx
<div data-testid="active-curriculums-widget">
  {curriculums.map(c => (
    <div key={c.id} data-testid="curriculum-row">…</div>
  ))}
</div>
```

Convention:

| Pattern | Example |
|---------|---------|
| Widget containers | `data-testid="<widget-name>-widget"` |
| List rows | `data-testid="<entity>-row"` |
| Form fields | Use `aria-label` / `label` — Playwright can find by role |
| Action buttons | Use `getByRole('button', { name: … })` |
| Status badges | `data-testid="status-badge"` |
| Error messages | `data-testid="error-message"` |

---

## 9. Scripts and CI integration

### 9.1 Package scripts

Add to `apps/web/package.json`:

```json
{
  "scripts": {
    "test:e2e":       "playwright test",
    "test:e2e:ui":    "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

Add to root `package.json`:

```json
{
  "scripts": {
    "test:e2e": "cd apps/web && npm run test:e2e"
  }
}
```

### 9.2 GitHub Actions job

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start E2E stack
        run: |
          cp .env.example .env
          echo "E2E_SEED_SECRET=ci-e2e-secret" >> .env
          docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d
          # Wait for the web server to be ready
          npx wait-on http://localhost:3001 --timeout 120000

      - uses: actions/setup-node@v4
        with: { node-version: 20 }

      - run: npm ci
      - run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        working-directory: apps/web
        env:
          E2E_BASE_URL:      http://localhost:3001
          NEXT_PUBLIC_API_URL: http://localhost:8001
          E2E_SEED_SECRET:   ci-e2e-secret
        run: npm run test:e2e

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
          retention-days: 7
```

### 9.3 Running locally

```bash
# 1. Start the E2E stack
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d

# 2. Wait until the web is up, then run tests
cd apps/web
E2E_BASE_URL=http://localhost:3001 NEXT_PUBLIC_API_URL=http://localhost:8001 \
  E2E_SEED_SECRET=e2e-local-secret npm run test:e2e

# 3. Open the HTML report
npx playwright show-report
```

Interactive UI mode (great for writing new tests):

```bash
npm run test:e2e:ui
```

---

## 10. What E2E tests should NOT do

E2E tests are slow and require the full stack. Keep them focused:

- **Do not** re-test validation logic already covered by Vitest form tests.
- **Do not** cover every error state — unit tests own that.
- **Do not** stub the API — E2E tests derive their value from the real backend.
- **Do not** mix E2E and unit tests in the same Vitest config.
- **Do not** run E2E tests on every commit — trigger them on PRs to `main` only,
  or nightly. Fast unit tests run on every push.

---

## 11. Dependency installation

```bash
cd apps/web
npm install --save-dev @playwright/test
npx playwright install chromium
```

Add to `apps/web/.gitignore`:

```
# Playwright
/playwright-report/
/test-results/
e2e/.auth.json
e2e/.fixtures.json
```

---

## 12. Implementation roadmap

| Phase | Work | Estimated effort |
|-------|------|-----------------|
| **1 — Infrastructure** | `docker-compose.e2e.yml`, seed endpoint + service, `playwright.config.ts`, `global-setup.ts`, `fixtures.ts` | 2 days |
| **2 — Auth flows** | Login, register, logout, forgot-password | 1 day |
| **3 — Dashboard assertions** | All 6 widgets verified against seeded data | 1–2 days |
| **4 — Core CRUD** | Subjects, curriculums, children, calendar event, note | 2–3 days |
| **5 — Full golden paths** | Onboarding wizard, project → certificate, invitation | 2 days |
| **6 — CI wiring** | GitHub Actions job, Playwright HTML reports as artifacts | 0.5 days |

Total: **~9–10 days** to reach meaningful coverage of all golden-path flows.

Keep E2E tests out of the `coverage` thresholds defined in `doc/11-testing-plan.md §1.4`.
They are complementary, not a replacement for unit coverage.
