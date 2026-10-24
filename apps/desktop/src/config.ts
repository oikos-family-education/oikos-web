import { randomBytes } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs';
import { join } from 'node:path';

/** The secrets, written once on first run and never rewritten: the database password lives only here. */
export interface AppConfig {
  jwtSecret: string;
  pgPassword: string;
}

/** What changes from run to run, kept apart so updating it never touches the secrets. */
export interface AppState {
  lastRunVersion: string | null;
}

const CONFIG_FILE = 'config.json';
const CONFIG_BACKUP_FILE = 'config.json.bak';
const STATE_FILE = 'state.json';

/**
 * Stands in for the last-run version when state.json is damaged: it matches no real version,
 * so the next start treats the run as an update and takes a safety copy before migrating.
 */
export const UNKNOWN_VERSION = 'unknown';

function secret(): string {
  return randomBytes(32).toString('hex');
}

function isConfig(value: unknown): value is AppConfig {
  const v = value as Partial<AppConfig> | null;
  return typeof v === 'object' && v !== null && typeof v.jwtSecret === 'string' && typeof v.pgPassword === 'string';
}

function isVersion(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * Writes `file` so that a crash or power cut leaves either the old or the new content:
 * a temp file is written and flushed to disk, then renamed over the target.
 */
export function writeFileDurably(file: string, content: string): void {
  const tmp = `${file}.tmp`;
  const fd = openSync(tmp, 'w', 0o600);
  try {
    writeSync(fd, content);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, file);
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${file} is damaged: ${(err as Error).message}`);
  }
}

/**
 * Reads `<userData>/config.json`, creating it with fresh secrets on first run (plus a one-time
 * `config.json.bak`). A damaged file is an error, never silently replaced: the database password lives in it.
 */
export function loadOrCreateConfig(userDataDir: string): AppConfig {
  const file = join(userDataDir, CONFIG_FILE);
  if (existsSync(file)) {
    const parsed = readJson(file);
    if (!isConfig(parsed)) throw new Error(`${file} is damaged: missing or invalid fields`);
    return { jwtSecret: parsed.jwtSecret, pgPassword: parsed.pgPassword };
  }
  mkdirSync(userDataDir, { recursive: true });
  const cfg: AppConfig = { jwtSecret: secret(), pgPassword: secret() };
  const content = JSON.stringify(cfg, null, 2) + '\n';
  writeFileDurably(join(userDataDir, CONFIG_BACKUP_FILE), content);
  writeFileDurably(file, content);
  return cfg;
}

/**
 * Reads `<userData>/state.json`. Before it existed, the last-run version was kept in config.json:
 * that value is read as the initial state (config.json itself is left as it is).
 */
export function loadState(userDataDir: string): AppState {
  const file = join(userDataDir, STATE_FILE);
  if (existsSync(file)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
      return { lastRunVersion: UNKNOWN_VERSION };
    }
    const version = (parsed as Partial<AppState> | null)?.lastRunVersion;
    return { lastRunVersion: isVersion(version) ? version : UNKNOWN_VERSION };
  }
  const legacy = join(userDataDir, CONFIG_FILE);
  if (existsSync(legacy)) {
    try {
      const version = (JSON.parse(readFileSync(legacy, 'utf8')) as { lastRunVersion?: unknown } | null)
        ?.lastRunVersion;
      if (typeof version === 'string') return { lastRunVersion: version };
    } catch {
      // loadOrCreateConfig reports a damaged config.json
    }
  }
  return { lastRunVersion: null };
}

/** Writes `<userData>/state.json` durably. Never touches config.json. */
export function saveState(userDataDir: string, state: AppState): void {
  mkdirSync(userDataDir, { recursive: true });
  writeFileDurably(join(userDataDir, STATE_FILE), JSON.stringify(state, null, 2) + '\n');
}
