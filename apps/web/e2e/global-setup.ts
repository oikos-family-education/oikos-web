/**
 * Playwright global setup — runs ONCE before the entire E2E suite.
 *
 *   1. POST /api/v1/e2e/seed       → wipes the DB and creates the fixture dataset.
 *   2. Logs in via the real login form, captures the auth cookies into
 *      `e2e/.auth.json`, which `playwright.config.ts` then reuses as the
 *      default `storageState` for every test (no per-test re-login).
 *
 * The fixture manifest returned by /seed is written to `e2e/.fixtures.json` so
 * tests can read fixture IDs without hardcoding values. Both files are
 * gitignored — see the root .gitignore.
 *
 * Reads `apps/web/.env.e2e` automatically via dotenv. See doc/12-e2e-testing-plan.md §4.3.
 */
import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const E2E_DIR = path.resolve(__dirname);
const FIXTURES_PATH = path.join(E2E_DIR, '.fixtures.json');
const AUTH_PATH = path.join(E2E_DIR, '.auth.json');

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001';
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3001';
const SECRET = process.env.E2E_SEED_SECRET;

async function globalSetup(_config: FullConfig): Promise<void> {
  if (!SECRET) {
    throw new Error(
      'E2E_SEED_SECRET is not set. Copy apps/web/.env.e2e.example to .env.e2e ' +
        'or export the variable before running Playwright.',
    );
  }

  // 1. Seed the database via the API endpoint --------------------------------
  const seedRes = await fetch(`${API}/api/v1/e2e/seed`, {
    method: 'POST',
    headers: { 'x-e2e-secret': SECRET },
  });
  if (!seedRes.ok) {
    const body = await seedRes.text().catch(() => '');
    throw new Error(
      `E2E seed failed: ${seedRes.status} ${seedRes.statusText}\n${body}\n` +
        `Is the API up at ${API}? Did you start the e2e Docker stack?`,
    );
  }
  const fixtures = await seedRes.json();
  fs.writeFileSync(FIXTURES_PATH, JSON.stringify(fixtures, null, 2));

  // 2. Log in once via the real form, capture the auth cookies ---------------
  // We deliberately drive the UI here (rather than POSTing to /api/v1/auth/login
  // directly) so any drift in the login flow surfaces during global setup
  // rather than as cryptic 401s in unrelated tests.
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL: BASE });
    const page = await context.newPage();

    await page.goto('/en/login');
    await page.getByLabel(/email/i).fill(fixtures.user.email);
    await page.getByLabel(/password/i).fill(fixtures.user.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for the post-login redirect. AuthProvider may bounce through
    // /onboarding/* before landing on /dashboard, so match the locale-prefixed
    // dashboard path.
    await page.waitForURL(/\/[a-z]{2}\/dashboard(\?|$)/, { timeout: 15_000 });

    // storageState captures cookies (including httpOnly) and localStorage so
    // every test starts already authenticated.
    await context.storageState({ path: AUTH_PATH });
    await context.close();
  } finally {
    await browser.close();
  }
}

export default globalSetup;
