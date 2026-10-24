import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../src/config';
import { resolvePaths } from '../src/paths';
import { PG_PORT, findBusyPorts } from '../src/ports';
import { startPostgres, stopOrphanedCluster } from '../src/postgres';
import { isAlive, waitForExit } from '../src/processes';

const cfg: AppConfig = { jwtSecret: 'a'.repeat(64), pgPassword: 'c0ffee'.repeat(10), lastRunVersion: null };
const portBusy = (await findBusyPorts([PG_PORT])).length > 0;

function freshPaths() {
  // User folders often contain accents and spaces (C:\Users\João Silva\...).
  const dir = mkdtempSync(join(tmpdir(), 'Oikos João Silva '));
  return resolvePaths(dir, join(dir, 'res'));
}

function postmasterPid(pgdata: string): number {
  return Number(readFileSync(join(pgdata, 'postmaster.pid'), 'utf8').split(/\r?\n/)[0]);
}

/** Resolves with the promise's outcome, or fails the test if it takes longer than `ms`. */
async function within<T>(ms: number, promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`still pending after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function deadPid(): number {
  const child = spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8' });
  return Number(child.stdout.trim());
}

// Real PostgreSQL 16 from the embedded-postgres platform package. Skipped when an Oikos
// desktop app (or anything else) already holds the port.
describe.skipIf(portBusy)('startPostgres (real PostgreSQL)', () => {
  it(
    'initialises once, creates the oikos database, stops cleanly and restarts on the same data',
    async () => {
      const paths = freshPaths();

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

  it(
    'a start that fails because the data folder is in use rejects promptly with the reason',
    async () => {
      const paths = freshPaths();
      const running = await startPostgres(paths, cfg);
      try {
        // A second postmaster on the same data exits at once ("lock file ... already exists").
        await expect(within(30_000, startPostgres(paths, cfg))).rejects.toThrow(/PostgreSQL did not start[\s\S]*postmaster\.pid/);
        expect(await running.hasUsers()).toBe(false);
      } finally {
        await within(30_000, running.stop());
      }
    },
    120_000,
  );

  it(
    'stop() resolves when Postgres has already died on its own',
    async () => {
      const paths = freshPaths();
      const handle = await startPostgres(paths, cfg);
      const pid = postmasterPid(paths.pgdata);
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(pid), '/f', '/t']);
      else process.kill(pid, 'SIGKILL');
      expect(await waitForExit(pid, 10_000)).toBe(true);
      await within(30_000, handle.stop());
    },
    120_000,
  );

  it(
    'stopOrphanedCluster stops a cluster left running by a previous app, and the next start is normal',
    async () => {
      const paths = freshPaths();
      const orphan = await startPostgres(paths, cfg);
      const pid = postmasterPid(paths.pgdata);

      expect(await stopOrphanedCluster(paths, cfg)).toMatch(new RegExp(`stopped .*PID ${pid}`));
      expect(isAlive(pid)).toBe(false);
      expect(existsSync(join(paths.pgdata, 'postmaster.pid'))).toBe(false);
      await within(30_000, orphan.stop());

      const next = await within(60_000, startPostgres(paths, cfg));
      await next.stop();
      expect(readFileSync(join(paths.logs, 'postgres.log'), 'utf8')).not.toContain('database system was interrupted');
    },
    120_000,
  );

  it(
    'never stops an unrelated Postgres whose PID was reused in our stale postmaster.pid',
    async () => {
      // Our cluster, shut down uncleanly long ago: its postmaster.pid is still there.
      const ours = freshPaths();
      await (await startPostgres(ours, cfg)).stop();
      // Another Postgres (another app, same user, even the same port and password) on a
      // DIFFERENT data folder now owns the PID that our stale file names.
      const other = freshPaths();
      const unrelated = await startPostgres(other, cfg);
      try {
        const pid = postmasterPid(other.pgdata);
        const ourPidFile = join(ours.pgdata, 'postmaster.pid');
        writeFileSync(ourPidFile, `${pid}\n${ours.pgdata.replace(/\\/g, '/')}\n1700000000\n${PG_PORT}\n\n127.0.0.1\n`);

        expect(await stopOrphanedCluster(ours, cfg)).toBeNull();
        expect(isAlive(pid)).toBe(true);
        expect(await unrelated.hasUsers()).toBe(false); // still serving
        expect(existsSync(ourPidFile)).toBe(true); // left for Postgres's own stale-lock check
        expect(readdirSync(ours.pgdata).filter((f) => f.startsWith('oikos-owner-'))).toEqual([]);
      } finally {
        await unrelated.stop();
      }
    },
    120_000,
  );

  it(
    'a stale postmaster.pid with a dead PID (power loss) does not block the next start',
    async () => {
      const paths = freshPaths();
      await (await startPostgres(paths, cfg)).stop();
      const pidFile = join(paths.pgdata, 'postmaster.pid');
      writeFileSync(pidFile, `${deadPid()}\n${paths.pgdata}\n1700000000\n${PG_PORT}\n\n127.0.0.1\n`);

      expect(await stopOrphanedCluster(paths, cfg)).toBeNull();
      const handle = await within(60_000, startPostgres(paths, cfg));
      try {
        expect(await handle.hasUsers()).toBe(false);
      } finally {
        await handle.stop();
      }
    },
    120_000,
  );
});

describe('stopOrphanedCluster without Postgres', () => {
  it('does nothing when there is no postmaster.pid', async () => {
    expect(await stopOrphanedCluster(freshPaths(), cfg)).toBeNull();
  });

  it('leaves a postmaster.pid whose PID now belongs to another program, and that program, alone', async () => {
    const paths = freshPaths();
    const other = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    try {
      mkdirSync(paths.pgdata, { recursive: true });
      writeFileSync(join(paths.pgdata, 'postmaster.pid'), `${other.pid}\n${paths.pgdata}\n`);
      expect(await stopOrphanedCluster(paths, cfg)).toBeNull();
      expect(existsSync(join(paths.pgdata, 'postmaster.pid'))).toBe(true);
      expect(isAlive(other.pid!)).toBe(true);
    } finally {
      other.kill();
    }
  });
});
