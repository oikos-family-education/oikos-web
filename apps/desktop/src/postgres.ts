import { execFile, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type EmbeddedPostgres from 'embedded-postgres';
import type { AppConfig } from './config.js';
import { closeLog, openLog } from './logs.js';
import type { AppPaths } from './paths.js';
import { PG_PORT } from './ports.js';

export interface PgHandle {
  /** True when the `users` table exists and has at least one row. */
  hasUsers(): Promise<boolean>;
  /** Fast, clean shutdown (no crash recovery needed on the next start). */
  stop(): Promise<void>;
}

interface PgClient {
  connect(): Promise<void>;
  query(sql: string): Promise<{ rows: Array<Record<string, unknown>> }>;
  end(): Promise<void>;
}

const DB = 'oikos';
const execFileAsync = promisify(execFile);

/** embedded-postgres keeps the postgres child private; we need it to stop cleanly on Windows. */
function internals(pg: EmbeddedPostgres): { process?: ChildProcess } {
  return pg as unknown as { process?: ChildProcess };
}

async function withClient<T>(pg: EmbeddedPostgres, database: string, fn: (c: PgClient) => Promise<T>): Promise<T> {
  const client = pg.getPgClient(database, '127.0.0.1') as unknown as PgClient;
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * Loads embedded-postgres and removes the process-exit handlers it installs on import
 * (async-exit-hook): on exit they throw ("done is not a function"), and on Windows they stop
 * Postgres with `taskkill /f`. main.ts owns shutdown; `killOnExit` below is the last resort.
 */
async function loadEmbeddedPostgres(): Promise<typeof EmbeddedPostgres> {
  const { default: EmbeddedPostgresClass } = await import('embedded-postgres');
  const exitHook = createRequire(import.meta.url)('async-exit-hook') as {
    hookedEvents(): string[];
    unhookEvent(event: string): void;
  };
  for (const event of exitHook.hookedEvents()) exitHook.unhookEvent(event);
  return EmbeddedPostgresClass;
}

/** If the app process ends without a clean stop (a crash), take Postgres down with it. */
function killOnExit(pg: EmbeddedPostgres): void {
  process.once('exit', () => {
    const child = internals(pg).process;
    if (!child?.pid || child.exitCode !== null) return;
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/f', '/t'], { windowsHide: true });
    else child.kill('SIGINT');
  });
}

/** pg_ctl from the same embedded-postgres platform package as the server binary. */
async function pgCtlPath(): Promise<string> {
  const pkg = '@embedded-postgres/windows-x64';
  const bins = (await import(pkg)) as { pg_ctl: string };
  return bins.pg_ctl;
}

/**
 * Starts the bundled PostgreSQL 16 on 127.0.0.1:PG_PORT with its data in `pgdata/`.
 * The first run initialises the cluster (role `oikos`); the `oikos` database is created when missing.
 */
export async function startPostgres(paths: AppPaths, cfg: AppConfig): Promise<PgHandle> {
  const log = openLog(paths.logs, 'postgres');
  let tail = '';
  const record = (message: string) => {
    log.write(message.endsWith('\n') ? message : `${message}\n`);
    tail = (tail + message).slice(-2_000);
  };
  const EmbeddedPostgresClass = await loadEmbeddedPostgres();
  const pg = new EmbeddedPostgresClass({
    databaseDir: paths.pgdata,
    port: PG_PORT,
    user: 'oikos',
    password: cfg.pgPassword,
    authMethod: 'scram-sha-256',
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
    onLog: record,
    onError: (err) => record(err instanceof Error ? err.message : String(err)),
  });

  try {
    if (!existsSync(join(paths.pgdata, 'PG_VERSION'))) await pg.initialise();
    killOnExit(pg);
    try {
      await pg.start();
    } catch (err) {
      // embedded-postgres rejects without a reason when postgres exits early.
      throw new Error(`PostgreSQL did not start. ${err instanceof Error ? err.message : ''}\n${tail.trim()}`);
    }
    await withClient(pg, 'postgres', async (c) => {
      const { rows } = await c.query(`SELECT 1 FROM pg_database WHERE datname = '${DB}'`);
      if (rows.length === 0) await c.query(`CREATE DATABASE ${DB}`);
    });
  } catch (err) {
    await pg.stop().catch(() => undefined);
    await closeLog(log);
    throw err;
  }

  return {
    hasUsers: () =>
      withClient(pg, DB, async (c) => {
        const table = await c.query(`SELECT to_regclass('public.users') IS NOT NULL AS present`);
        if (!table.rows[0]?.present) return false;
        const users = await c.query('SELECT EXISTS (SELECT 1 FROM users) AS present');
        return Boolean(users.rows[0]?.present);
      }),

    async stop() {
      const child = internals(pg).process;
      if (child && child.exitCode === null && process.platform === 'win32') {
        // embedded-postgres stops with `taskkill /f` on Windows, a crash as far as Postgres is
        // concerned. pg_ctl delivers a real fast-shutdown request instead.
        try {
          const exited = once(child, 'exit').catch(() => undefined);
          await execFileAsync(await pgCtlPath(), ['stop', '-D', paths.pgdata, '-m', 'fast', '-w', '-t', '60'], {
            cwd: dirname(paths.pgdata),
            windowsHide: true,
          });
          await exited;
          internals(pg).process = undefined;
        } catch (err) {
          record(`pg_ctl stop failed, forcing: ${(err as Error).message}`);
        }
      }
      // Elsewhere this sends SIGINT (fast shutdown); on Windows it is the fallback.
      await pg.stop();
      await closeLog(log);
    },
  };
}
