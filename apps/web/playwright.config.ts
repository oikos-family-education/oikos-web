/**
 * Playwright configuration for end-to-end browser tests.
 *
 * This config is for E2E only and is completely separate from `vitest.config.ts`,
 * which drives the in-process unit/component test suite. The two never share
 * test files — Playwright only picks up `apps/web/e2e/**`.
 *
 * See doc/12-e2e-testing-plan.md for the broader strategy.
 */
import { defineConfig, devices } from '@playwright/test';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

// Load `.env.e2e` if present so developers don't have to export variables in
// their shell. CI passes the values via job-level env: blocks instead.
dotenv.config({ path: path.resolve(__dirname, '.env.e2e') });

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  // Don't pick up `.example` files or the helper modules.
  testMatch: /.*\.spec\.ts$/,
  globalSetup: require.resolve('./e2e/global-setup.ts'),
  globalTeardown: require.resolve('./e2e/global-teardown.ts'),

  fullyParallel: true,
  // Fail the build on .only() in CI so a stray focus doesn't silently skip the suite.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html', { open: 'on-failure' }]],
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    // Every test starts already logged-in via the cookies captured in global setup.
    // Specs that need an unauthenticated context must opt out with
    // `test.use({ storageState: { cookies: [], origins: [] } })`.
    storageState: path.resolve(__dirname, 'e2e/.auth.json'),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Add Firefox / WebKit projects in CI once the suite stabilises.
  ],

  // We deliberately do NOT use Playwright's `webServer` option to start the
  // app. The Docker Compose e2e stack (docker-compose.e2e.yml) owns the API
  // and web processes, and starting another `next dev` from here would race
  // with the containerised one. Make sure the stack is up before running:
  //
  //   docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d
});
