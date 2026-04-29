/**
 * E2E spec: Active Curriculums dashboard widget.
 *
 * Verifies the user-visible behaviour described in the original request:
 * "log in → navigate to the dashboard → assert the curriculum section
 * contains all the active curriculums."
 *
 * The fixture dataset (see apps/api/app/services/e2e_seed_service.py) seeds
 * 3 curriculums — 2 with status='active' (Math, Science) and 1 with
 * status='archived' (History). The widget's client-side filter is
 * `status === 'active'`, so only Math and Science should appear.
 *
 * Auth is preloaded via `storageState` from playwright.config.ts — every
 * test starts already logged in as the seed user.
 */
import { test, expect } from '../fixtures';

interface CurriculumListItem {
  id: string;
  name: string;
  status: string;
}

test.describe('Dashboard — Active Curriculums widget', () => {
  test.beforeEach(async ({ page }) => {
    // The dashboard makes a few async fetches per widget. `networkidle` waits
    // for them to settle, which keeps assertions stable across machines.
    await page.goto('/en/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('renders the widget with its localized heading', async ({ page }) => {
    // Heading text comes from messages/en.json → "Curriculums".
    // We deliberately scope the role query inside the widget so a stray
    // <h2> elsewhere on the dashboard can't false-positive.
    const widget = page.getByTestId('active-curriculums-widget');
    await expect(widget).toBeVisible();
    await expect(widget.getByRole('heading', { name: /curriculums/i })).toBeVisible();
  });

  test('shows every active curriculum and hides the archived one', async ({
    page,
    fixtureData,
  }) => {
    const widget = page.getByTestId('active-curriculums-widget');
    const rows = widget.getByTestId('curriculum-row');

    // Active ones must be present
    await expect(rows.filter({ hasText: fixtureData.curriculums.math.name })).toHaveCount(1);
    await expect(rows.filter({ hasText: fixtureData.curriculums.science.name })).toHaveCount(1);

    // Archived must NOT appear at all
    await expect(rows.filter({ hasText: fixtureData.curriculums.history.name })).toHaveCount(0);
  });

  test('row count matches the seed manifest', async ({ page, fixtureData }) => {
    const widget = page.getByTestId('active-curriculums-widget');
    const rows = widget.getByTestId('curriculum-row');
    await expect(rows).toHaveCount(fixtureData.expected.active_curriculum_count);
  });

  test('row count matches the live API response (cross-check)', async ({ page, request }) => {
    // The widget fetches /api/v1/curriculums and filters client-side to
    // status === 'active'. We replicate that filter here so a future server-side
    // change (e.g. adding a ?status= query param) is caught instead of silently
    // hiding curriculums.
    //
    // The `request` fixture inherits cookies from the project's `storageState`,
    // so no manual auth header is needed.
    const apiRes = await request.get('/api/v1/curriculums');
    expect(apiRes.ok(), `API call failed: ${apiRes.status()}`).toBeTruthy();

    const all = (await apiRes.json()) as CurriculumListItem[];
    const activeFromApi = all.filter((c) => c.status === 'active');

    const widget = page.getByTestId('active-curriculums-widget');
    const uiRowCount = await widget.getByTestId('curriculum-row').count();

    expect(uiRowCount).toBe(activeFromApi.length);
  });

  test('each row links to its curriculum detail page', async ({ page, fixtureData }) => {
    const widget = page.getByTestId('active-curriculums-widget');

    // Each row carries `data-curriculum-id`; the inner <a> targets
    // /<locale>/curriculums/<id>. Assert both the test attribute and the href
    // — the former proves we found the right row, the latter is what users
    // actually click.
    const mathRow = widget.locator(
      `[data-testid="curriculum-row"][data-curriculum-id="${fixtureData.curriculums.math.id}"]`,
    );
    await expect(mathRow).toBeVisible();

    const link = mathRow.getByRole('link');
    await expect(link).toHaveAttribute(
      'href',
      new RegExp(`/curriculums/${fixtureData.curriculums.math.id}$`),
    );
  });

  test('clicking a row navigates to the curriculum detail page', async ({
    page,
    fixtureData,
  }) => {
    const widget = page.getByTestId('active-curriculums-widget');
    const mathRow = widget.locator(
      `[data-testid="curriculum-row"][data-curriculum-id="${fixtureData.curriculums.math.id}"]`,
    );
    await mathRow.getByRole('link').click();

    await expect(page).toHaveURL(
      new RegExp(`/[a-z]{2}/curriculums/${fixtureData.curriculums.math.id}(\\?|$)`),
    );
  });
});

/**
 * Empty-state coverage is deferred. To exercise it we'd need either:
 *   (a) a seeded user with zero curriculums (a "minimal" seed variant), or
 *   (b) a per-user truncate that doesn't invalidate the auth cookie.
 *
 * `e2eApi.reset()` truncates the users table, which would break the cached
 * storageState mid-suite. Implementing the minimal seed is tracked for §7
 * of the plan.
 */
