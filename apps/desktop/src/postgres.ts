import { execFile, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import type EmbeddedPostgres from 'embedded-postgres';
import type { AppConfig } from './config.js';
import { closeLog, openLog } from './logs.js';
import type { AppPaths } from './paths.js';
import { PG_PORT } from './ports.js';
import { isAlive, killTree, waitForExit } from './processes.js';

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
const START_TIMEOUT_MS = 120_000;
const STOP_TIMEOUT_MS = 30_000;
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

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

/**
 * embedded-postgres's stop() waits for an `exit` event, so it never resolves once the postgres
 * child has already exited. Forget such a child first.
 */
function forgetIfExited(pg: EmbeddedPostgres): void {
  const child = internals(pg).process;
  if (child && hasExited(child)) internals(pg).process = undefined;
}

/** Rejects with `message` if `promise` has not settled after `ms`. */
function timeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** If the app process ends without a clean stop (a crash), take Postgres down with it. */
function killOnExit(pg: EmbeddedPostgres): void {
  process.once('exit', () => {
    const child = internals(pg).process;
    if (child?.pid && !hasExited(child)) killTree(child.pid);
  });
}

/** pg_ctl from the same embedded-postgres platform package as the server binary. */
async function pgCtlPath(): Promise<string> {
  const os = process.platform === 'win32' ? 'windows' : process.platform;
  const pkg = `@embedded-postgres/${os}-${process.arch}`;
  const bins = (await import(pkg)) as { pg_ctl: string };
  return bins.pg_ctl;
}

async function pgCtlStop(pgdata: string): Promise<void> {
  await execFileAsync(await pgCtlPath(), ['stop', '-D', pgdata, '-m', 'fast', '-w', '-t', '60'], {
    cwd: dirname(pgdata),
    windowsHide: true,
  });
}

/**
 * Stops the cluster. Always settles: a child that already exited is forgotten, and a stop that
 * hangs ends with a forced kill.
 */
async function stopCluster(pg: EmbeddedPostgres, pgdata: string, record: (m: string) => void): Promise<void> {
  const child = internals(pg).process;
  if (child && !hasExited(child) && process.platform === 'win32') {
    // embedded-postgres stops with `taskkill /f` on Windows, a crash as far as Postgres is
    // concerned. pg_ctl delivers a real fast-shutdown request instead.
    try {
      const exited = once(child, 'exit').catch(() => undefined);
      await pgCtlStop(pgdata);
      await timeout(exited, STOP_TIMEOUT_MS, 'postgres did not exit');
    } catch (err) {
      record(`pg_ctl stop failed, forcing: ${(err as Error).message}`);
    }
  }
  forgetIfExited(pg);
  // Elsewhere this sends SIGINT (fast shutdown); on Windows it is the fallback.
  try {
    await timeout(pg.stop(), STOP_TIMEOUT_MS, 'PostgreSQL did not stop in time');
  } catch (err) {
    record(`${(err as Error).message}, forcing`);
    const stuck = internals(pg).process;
    if (stuck?.pid) killTree(stuck.pid);
    internals(pg).process = undefined;
  }
}

/**
 * Postgres on Windows stores the data path in the ANSI code page, so the path in postmaster.pid
 * and `SHOW data_directory` lose non-ASCII characters (`João` comes back as `Jo\uFFFDo`).
 * Compare paths with every non-ASCII character treated as unknown.
 */
function comparablePath(path: string): string {
  let p = resolve(path).replace(/\\/g, '/').replace(/\/+$/, '');
  p = p.replace(/[^\x00-\x7f]+/g, '?');
  return process.platform === 'win32' ? p.toLowerCase() : p;
}

/**
 * True only when the server answering on 127.0.0.1:PG_PORT accepts our credentials AND serves
 * our data folder. Proof: it reads back, from its own data directory (pg_read_file with a
 * relative path), a one-off token we just wrote into `pgdata`. Encoding-proof, unlike comparing
 * `SHOW data_directory` (see comparablePath).
 */
async function servesOurData(paths: AppPaths, cfg: AppConfig): Promise<boolean> {
  const name = `oikos-owner-${randomBytes(8).toString('hex')}`;
  const token = randomBytes(16).toString('hex');
  const file = join(paths.pgdata, name);
  writeFileSync(file, token);
  try {
    const EmbeddedPostgresClass = await loadEmbeddedPostgres();
    const probe = new EmbeddedPostgresClass({ port: PG_PORT, user: 'oikos', password: cfg.pgPassword, onLog: () => {}, onError: () => {} });
    const read = withClient(probe, 'postgres', async (c) => (await c.query(`SELECT pg_read_file('${name}') AS token`)).rows[0]?.token);
    return (await timeout(read, 10_000, 'no answer')) === token;
  } catch {
    return false; // no server, wrong password, not our data folder, or no answer
  } finally {
    rmSync(file, { force: true });
  }
}

/**
 * Run before starting: stops our own cluster if a previous run (a crash, a force-quit) left it
 * running. Returns what it did, or null when there was nothing to do.
 *
 * It signals a process only after proving it is our cluster: postmaster.pid names a live PID,
 * the file's data folder (line 2) is ours, and the server on our port with our credentials
 * serves our data folder. Anything else (a dead PID, a PID now used by another program or by
 * another Postgres) is left alone, file included: Postgres's own stale-lock check decides.
 */
export async function stopOrphanedCluster(paths: AppPaths, cfg: AppConfig): Promise<string | null> {
  const pidFile = join(paths.pgdata, 'postmaster.pid');
  if (!existsSync(pidFile)) return null;
  // latin1 keeps one character per byte, whatever code page Postgres wrote the path in.
  const [pidLine = '', dataDirLine = ''] = readFileSync(pidFile, 'latin1').split(/\r?\n/);
  const pid = Number(pidLine);
  if (!Number.isInteger(pid) || pid <= 0 || !isAlive(pid)) return null;
  if (comparablePath(dataDirLine) !== comparablePath(paths.pgdata)) return null;
  if (!(await servesOurData(paths, cfg))) return null;

  await pgCtlStop(paths.pgdata);
  if (!(await waitForExit(pid, STOP_TIMEOUT_MS))) {
    throw new Error(`PostgreSQL left running by a previous start (PID ${pid}) did not stop`);
  }
  return `stopped PostgreSQL left running by a previous start (PID ${pid})`;
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
      await timeout(pg.start(), START_TIMEOUT_MS, 'Timed out waiting for PostgreSQL to accept connections.');
    } catch (err) {
      // embedded-postgres rejects without a reason when postgres exits early; the log tail has it.
      throw new Error(`PostgreSQL did not start. ${err instanceof Error ? err.message : ''}\n${tail.trim()}`);
    }
    await withClient(pg, 'postgres', async (c) => {
      const { rows } = await c.query(`SELECT 1 FROM pg_database WHERE datname = '${DB}'`);
      if (rows.length === 0) await c.query(`CREATE DATABASE ${DB}`);
    });
  } catch (err) {
    await stopCluster(pg, paths.pgdata, record);
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
      await stopCluster(pg, paths.pgdata, record);
      await closeLog(log);
    },
  };
}
