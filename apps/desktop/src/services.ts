import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { utilityProcess, type UtilityProcess } from 'electron';
import type { AppConfig } from './config.js';
import { closeLog, closeLogAfter, keepTail, openLog, pipeToLog } from './logs.js';
import type { AppPaths } from './paths.js';
import { API_PORT, PG_PORT, WEB_PORT } from './ports.js';
import { isAlive, killTree, processImage, waitForExit } from './processes.js';

/** The environment the `oikos-api` CLI reads (see apps/api/desktop_entry.py). */
export function apiEnv(paths: AppPaths, cfg: AppConfig, appVersion: string): NodeJS.ProcessEnv {
  const db = `oikos:${encodeURIComponent(cfg.pgPassword)}@127.0.0.1:${PG_PORT}/oikos`;
  return {
    ...process.env,
    APP_MODE: 'desktop',
    DATABASE_URL: `postgresql+asyncpg://${db}`,
    DATABASE_SYNC_URL: `postgresql://${db}`,
    JWT_SECRET_KEY: cfg.jwtSecret,
    SESSIONS_DB_PATH: paths.sessionsDb,
    BACKUP_DIR: paths.backups,
    APP_VERSION: appVersion,
    ALEMBIC_INI_PATH: paths.alembicIni,
  };
}

function spawnApi(paths: AppPaths, args: string[], env: NodeJS.ProcessEnv, logName: string) {
  if (!existsSync(paths.apiExe)) throw new Error(`The Oikos API was not found at ${paths.apiExe}`);
  const log = openLog(paths.logs, logName);
  const child = spawn(paths.apiExe, args, {
    cwd: dirname(paths.apiExe),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  pipeToLog(child.stdout, log);
  pipeToLog(child.stderr, log);
  child.once('error', (err) => {
    log.write(`${err.message}\n`);
    void closeLog(log);
  });
  child.once('exit', (code) => log.write(`${logName} exited (code ${code})\n`));
  child.once('close', () => void closeLog(log));
  return { child, log };
}

/** Runs `oikos-api migrate` (db check, alembic upgrade, seeds). Rejects with the stderr tail. */
export async function runMigrations(paths: AppPaths, env: NodeJS.ProcessEnv): Promise<void> {
  const { child, log } = spawnApi(paths, ['migrate'], env, 'migrate');
  const stderr = keepTail(child.stderr);
  const code = await new Promise<number | null>((resolve) => {
    child.once('error', () => resolve(null));
    child.once('close', resolve);
  });
  await closeLog(log);
  if (code !== 0) throw new Error(`Database migration failed (exit ${code}): ${stderr() || 'no output'}`);
}

/** Starts `oikos-api serve` on 127.0.0.1:API_PORT. Output goes to logs/api.log. */
export function startApi(paths: AppPaths, env: NodeJS.ProcessEnv): ChildProcess {
  const { child } = spawnApi(paths, ['serve', '--port', String(API_PORT)], env, 'api');
  if (child.pid) {
    mkdirSync(dirname(paths.apiPid), { recursive: true });
    writeFileSync(paths.apiPid, String(child.pid));
    child.once('exit', () => rmSync(paths.apiPid, { force: true }));
  }
  return child;
}

/**
 * Run before starting: stops an API left running by an app that did not shut down (a crash,
 * a force-quit), using the PID recorded in `api.pid`. Only a process still running the Oikos API
 * program is stopped. Returns what it did, or null when there was nothing to do.
 */
export async function stopOrphanedApi(paths: AppPaths): Promise<string | null> {
  if (!existsSync(paths.apiPid)) return null;
  const pid = Number(readFileSync(paths.apiPid, 'utf8').trim());
  rmSync(paths.apiPid, { force: true });
  if (!Number.isInteger(pid) || pid <= 0 || !isAlive(pid)) return null;
  const image = await processImage(pid);
  if (!image || basename(image).toLowerCase() !== basename(paths.apiExe).toLowerCase()) return null;
  killTree(pid);
  if (!(await waitForExit(pid, 10_000))) throw new Error(`The Oikos API left running by a previous start (PID ${pid}) did not stop`);
  return `stopped the Oikos API left running by a previous start (PID ${pid})`;
}

/**
 * Starts the Next.js standalone server with Electron's Node. HOSTNAME must be `localhost`,
 * not 127.0.0.1: Next 14.2.3 turns every locale rewrite into a self-redirect loop otherwise.
 * ipv4first makes `localhost` resolve to 127.0.0.1, so it binds IPv4 loopback only.
 */
export function startWeb(paths: AppPaths): UtilityProcess {
  if (!existsSync(paths.webServerJs)) throw new Error(`The Oikos web server was not found at ${paths.webServerJs}`);
  const log = openLog(paths.logs, 'web');
  const nodeOptions = [process.env.NODE_OPTIONS, '--dns-result-order=ipv4first'].filter(Boolean).join(' ');
  const child = utilityProcess.fork(paths.webServerJs, [], {
    cwd: dirname(paths.webServerJs),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(WEB_PORT),
      HOSTNAME: 'localhost',
      NODE_OPTIONS: nodeOptions,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: 'pipe',
    serviceName: 'Oikos web server',
  });
  pipeToLog(child.stdout, log);
  pipeToLog(child.stderr, log);
  child.once('exit', (code) => log.write(`web server exited (code ${code})\n`));
  void closeLogAfter(log, [child.stdout, child.stderr]);
  return child;
}

/** Polls `url` until it answers 2xx, or rejects after `timeoutMs`. */
export async function waitForHealth(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = 'no answer';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(Math.min(2_000, timeoutMs)), redirect: 'manual' });
      await res.body?.cancel();
      if (res.ok) return;
      last = `HTTP ${res.status}`;
    } catch (err) {
      last = (err as Error).message;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url} (${last})`);
}
