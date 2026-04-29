/**
 * Playwright global teardown — runs ONCE after the entire E2E suite.
 *
 * Resets the DB to an empty state and removes the auth/fixture files written
 * by global-setup. Failures here are logged but never fail the test run —
 * teardown errors should not mask test failures.
 *
 * See doc/12-e2e-testing-plan.md §4.3.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const E2E_DIR = path.resolve(__dirname);
const FIXTURES_PATH = path.join(E2E_DIR, '.fixtures.json');
const AUTH_PATH = path.join(E2E_DIR, '.auth.json');

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001';
const SECRET = process.env.E2E_SEED_SECRET;

async function globalTeardown(): Promise<void> {
  if (SECRET) {
    try {
      const res = await fetch(`${API}/api/v1/e2e/reset`, {
        method: 'POST',
        headers: { 'x-e2e-secret': SECRET },
      });
      if (!res.ok) {
        // Log but don't throw — keep teardown idempotent.
        // eslint-disable-next-line no-console
        console.warn(`E2E reset returned ${res.status}; continuing teardown.`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('E2E reset request failed; continuing teardown:', err);
    }
  }

  // Remove cached state. The CI artifacts uploader picks up traces and
  // screenshots from playwright-report/, not these files.
  fs.rmSync(FIXTURES_PATH, { force: true });
  fs.rmSync(AUTH_PATH, { force: true });
}

export default globalTeardown;
