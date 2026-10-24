import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type { AppConfig } from './config.js';
import { closeLog, keepTail, openLog, pipeToLog } from './logs.js';
import type { AppPaths } from './paths.js';
import { PG_PORT } from './ports.js';

export const PREMIGRATE_PREFIX = 'auto-premigrate-';
const KEEP = 5;

/** `20261024T153347123Z`: sorts by name in time order, like the API's own safety copies. */
function timestamp(): string {
  return new Date().toISOString().replace(/[-:.]/g, '');
}

/**
 * Dumps the whole database (`pg_dump -Fc`) into `backups/auto-premigrate-<timestamp>.dump`
 * before migrations run on a version change, then keeps only the newest few.
 * Resolves with the file path; on failure removes the partial file and rejects with pg_dump's stderr.
 */
export async function writePremigrateCopy(paths: AppPaths, cfg: AppConfig): Promise<string> {
  if (!existsSync(paths.pgDumpExe)) throw new Error(`pg_dump not found at ${paths.pgDumpExe}`);
  mkdirSync(paths.backups, { recursive: true });
  const file = join(paths.backups, `${PREMIGRATE_PREFIX}${timestamp()}.dump`);
  const args = ['-Fc', '-w', '-h', '127.0.0.1', '-p', String(PG_PORT), '-U', 'oikos', '-d', 'oikos', '-f', file];

  const log = openLog(paths.logs, 'migrate');
  log.write(`pg_dump -> ${file}\n`);
  const child = spawn(paths.pgDumpExe, args, {
    env: { ...process.env, PGPASSWORD: cfg.pgPassword },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  pipeToLog(child.stdout, log);
  pipeToLog(child.stderr, log);
  const stderr = keepTail(child.stderr);

  const code = await new Promise<number | null>((resolve) => {
    child.once('error', (err) => {
      log.write(`${err.message}\n`);
      resolve(null);
    });
    child.once('close', resolve);
  });
  await closeLog(log);
  if (code !== 0) {
    rmSync(file, { force: true });
    throw new Error(`pg_dump failed (exit ${code}): ${stderr() || 'no output'}`);
  }
  pruneBackups(paths.backups, PREMIGRATE_PREFIX, KEEP);
  return file;
}

/** Deletes all but the `keep` newest files starting with `prefix`. Returns the deleted paths. */
export function pruneBackups(dir: string, prefix: string, keep: number): string[] {
  if (!existsSync(dir)) return [];
  const names = readdirSync(dir)
    .filter((name) => name.startsWith(prefix))
    .sort()
    .reverse();
  const deleted = names.slice(keep).map((name) => join(dir, name));
  for (const file of deleted) rmSync(file, { force: true });
  return deleted;
}
