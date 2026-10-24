import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface AppConfig {
  jwtSecret: string;
  pgPassword: string;
  lastRunVersion: string | null;
}

const FILE = 'config.json';

function secret(): string {
  return randomBytes(32).toString('hex');
}

function isConfig(value: unknown): value is AppConfig {
  const v = value as Partial<AppConfig> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.jwtSecret === 'string' &&
    typeof v.pgPassword === 'string' &&
    (v.lastRunVersion === null || typeof v.lastRunVersion === 'string')
  );
}

/**
 * Reads `<userData>/config.json`, creating it with fresh secrets on first run.
 * A damaged file is an error, never silently replaced: the database password lives in it.
 */
export function loadOrCreateConfig(userDataDir: string): AppConfig {
  const file = join(userDataDir, FILE);
  if (existsSync(file)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`${file} is damaged: ${(err as Error).message}`);
    }
    if (!isConfig(parsed)) throw new Error(`${file} is damaged: missing or invalid fields`);
    return { jwtSecret: parsed.jwtSecret, pgPassword: parsed.pgPassword, lastRunVersion: parsed.lastRunVersion };
  }
  const cfg: AppConfig = { jwtSecret: secret(), pgPassword: secret(), lastRunVersion: null };
  saveConfig(userDataDir, cfg);
  return cfg;
}

/** Writes the config atomically (temp file, then rename). */
export function saveConfig(dir: string, cfg: AppConfig): void {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, FILE);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
  renameSync(tmp, file);
}
