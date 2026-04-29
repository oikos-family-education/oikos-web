/**
 * Shared Playwright test fixture: exposes the seeded fixture manifest as
 * `fixtureData` and a typed `e2eRequest` helper for hitting the seed/reset
 * endpoints without copy-pasting the secret header in every spec.
 *
 * Tests should import `{ test, expect }` from THIS file rather than
 * `@playwright/test` directly, so they get the extended fixtures.
 *
 * See doc/12-e2e-testing-plan.md §5.1.
 */
import { test as base, expect, type APIRequestContext } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ────────────────────────────────────────────────────────────────────────────
// Manifest types — keep in sync with `seed_e2e_data` in the API.
// ────────────────────────────────────────────────────────────────────────────

export interface FixtureManifest {
  user: { email: string; password: string; id: string };
  family: { id: string; name: string; slug: string };
  children: {
    alice: { id: string; name: string };
    bob: { id: string; name: string };
  };
  subjects: {
    math: { id: string; name: string };
    science: { id: string; name: string };
    history: { id: string; name: string };
  };
  curriculums: {
    math: { id: string; name: string; status: 'active' };
    science: { id: string; name: string; status: 'active' };
    history: { id: string; name: string; status: 'archived' };
  };
  expected: {
    active_curriculum_count: number;
    archived_curriculum_count: number;
  };
}

const FIXTURES_PATH = path.resolve(__dirname, '.fixtures.json');

function loadFixtures(): FixtureManifest {
  if (!fs.existsSync(FIXTURES_PATH)) {
    throw new Error(
      `Fixture manifest not found at ${FIXTURES_PATH}. ` +
        'Did Playwright global setup run? Run `npm run test:e2e` from apps/web.',
    );
  }
  return JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8')) as FixtureManifest;
}

// ────────────────────────────────────────────────────────────────────────────
// e2eRequest — pre-authenticated helper for the seed endpoints.
// ────────────────────────────────────────────────────────────────────────────

export interface E2eApi {
  /** Wipe + reseed. Returns the fresh manifest. */
  reseed(): Promise<FixtureManifest>;
  /** Wipe only — leaves DB empty. Use for empty-state tests. */
  reset(): Promise<void>;
}

function makeE2eApi(request: APIRequestContext): E2eApi {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001';
  const secret = process.env.E2E_SEED_SECRET ?? '';

  if (!secret) {
    // Fail fast inside the test, not at module load — keeps unit tests on
    // this file possible if we ever add them.
    throw new Error('E2E_SEED_SECRET is not set; e2eApi cannot authenticate.');
  }

  const headers = { 'x-e2e-secret': secret };

  return {
    async reseed() {
      const res = await request.post(`${apiBase}/api/v1/e2e/reseed`, { headers });
      if (!res.ok()) throw new Error(`reseed failed: ${res.status()}`);
      return (await res.json()) as FixtureManifest;
    },
    async reset() {
      const res = await request.post(`${apiBase}/api/v1/e2e/reset`, { headers });
      if (!res.ok()) throw new Error(`reset failed: ${res.status()}`);
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Extended `test` — every test gets `fixtureData` and `e2eApi` for free.
// ────────────────────────────────────────────────────────────────────────────

interface Fixtures {
  fixtureData: FixtureManifest;
  e2eApi: E2eApi;
}

export const test = base.extend<Fixtures>({
  // Loaded once per worker; subsequent tests in the same worker reuse the
  // parsed object.
  // eslint-disable-next-line no-empty-pattern
  fixtureData: async ({}, use) => {
    await use(loadFixtures());
  },

  e2eApi: async ({ request }, use) => {
    await use(makeE2eApi(request));
  },
});

export { expect };
