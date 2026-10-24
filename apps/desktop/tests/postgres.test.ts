import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../src/config';
import { resolvePaths } from '../src/paths';
import { PG_PORT, findBusyPorts } from '../src/ports';
import { startPostgres } from '../src/postgres';

const cfg: AppConfig = { jwtSecret: 'a'.repeat(64), pgPassword: 'c0ffee'.repeat(10), lastRunVersion: null };
const portBusy = (await findBusyPorts([PG_PORT])).length > 0;

// Real PostgreSQL 16 from the embedded-postgres platform package. Skipped when an Oikos
// desktop app (or anything else) already holds the port.
describe.skipIf(portBusy)('startPostgres (real PostgreSQL)', () => {
  it(
    'initialises once, creates the oikos database, stops cleanly and restarts on the same data',
    async () => {
      // User folders often contain accents and spaces (C:\Users\João Silva\...).
      const dir = mkdtempSync(join(tmpdir(), 'Oikos João Silva '));
      const paths = resolvePaths(dir, join(dir, 'res'));

      const first = await startPostgres(paths, cfg);
      try {
        expect(await first.hasUsers()).toBe(false);
      } finally {
        await first.stop();
      }
      expect(existsSync(join(paths.pgdata, 'postmaster.pid'))).toBe(false);
      const log = readFileSync(join(paths.logs, 'postgres.log'), 'utf8');
      expect(log).toContain('database system is shut down');
      expect(log).not.toContain('database system was interrupted');

      const second = await startPostgres(paths, cfg);
      try {
        const client = new pg.Client({
          host: '127.0.0.1',
          port: PG_PORT,
          user: 'oikos',
          password: cfg.pgPassword,
          database: 'oikos',
        });
        await client.connect();
        await client.query('CREATE TABLE users (id int)');
        expect(await second.hasUsers()).toBe(false);
        await client.query('INSERT INTO users VALUES (1)');
        await client.end();
        expect(await second.hasUsers()).toBe(true);
      } finally {
        await second.stop();
      }
      expect(readFileSync(join(paths.logs, 'postgres.log'), 'utf8')).not.toContain('database system was interrupted');
    },
    120_000,
  );
});
