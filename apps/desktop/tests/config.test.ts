import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Record the file-system calls that make a write durable, in order
const fsCalls = vi.hoisted(() => ({ log: [] as string[] }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const fdNames = new Map<number, string>();
  return {
    ...actual,
    openSync: (path: string, ...rest: [string, number]) => {
      const fd = actual.openSync(path, ...rest);
      fdNames.set(fd, basename(path));
      fsCalls.log.push(`open ${basename(path)}`);
      return fd;
    },
    writeSync: (fd: number, data: string) => {
      fsCalls.log.push(`write ${fdNames.get(fd)}`);
      return actual.writeSync(fd, data);
    },
    fsyncSync: (fd: number) => {
      fsCalls.log.push(`fsync ${fdNames.get(fd)}`);
      return actual.fsyncSync(fd);
    },
    closeSync: (fd: number) => {
      fsCalls.log.push(`close ${fdNames.get(fd)}`);
      return actual.closeSync(fd);
    },
    renameSync: (from: string, to: string) => {
      fsCalls.log.push(`rename ${basename(from)} -> ${basename(to)}`);
      return actual.renameSync(from, to);
    },
  };
});

import { UNKNOWN_VERSION, loadOrCreateConfig, loadState, saveState } from '../src/config';

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'oikos '));
}

const read = (dir: string, name: string) => readFileSync(join(dir, name), 'utf8');

beforeEach(() => {
  fsCalls.log.length = 0;
});

describe('config', () => {
  it('loadOrCreateConfig creates once and then reuses', () => {
    const dir = tempDir();
    const a = loadOrCreateConfig(dir);
    const b = loadOrCreateConfig(dir);
    expect(a.jwtSecret).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toEqual(a);
  });

  it('generates two independent secrets and nothing else', () => {
    const cfg = loadOrCreateConfig(tempDir());
    expect(cfg.pgPassword).toMatch(/^[0-9a-f]{64}$/);
    expect(cfg.pgPassword).not.toBe(cfg.jwtSecret);
    expect(Object.keys(cfg).sort()).toEqual(['jwtSecret', 'pgPassword']);
  });

  it('creates the user-data folder when it does not exist yet', () => {
    const dir = join(tempDir(), 'nested', 'Oikos');
    loadOrCreateConfig(dir);
    expect(JSON.parse(read(dir, 'config.json')).jwtSecret).toMatch(/^[0-9a-f]{64}$/);
  });

  it('writes config.json durably: flushed to disk before it is renamed into place', () => {
    const dir = tempDir();
    loadOrCreateConfig(dir);
    const configWrite = fsCalls.log.filter((c) => c.includes('config.json.tmp') || c.endsWith('-> config.json'));
    expect(configWrite).toEqual([
      'open config.json.tmp',
      'write config.json.tmp',
      'fsync config.json.tmp',
      'close config.json.tmp',
      'rename config.json.tmp -> config.json',
    ]);
    expect(existsSync(join(dir, 'config.json.tmp'))).toBe(false);
  });

  it('keeps a one-time copy of the secrets in config.json.bak', () => {
    const dir = tempDir();
    loadOrCreateConfig(dir);
    expect(read(dir, 'config.json.bak')).toBe(read(dir, 'config.json'));
    fsCalls.log.length = 0;
    loadOrCreateConfig(dir);
    expect(fsCalls.log).toEqual([]);
  });

  it('refuses a damaged config instead of replacing the secrets', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'config.json'), '{"jwtSecret": ');
    expect(() => loadOrCreateConfig(dir)).toThrow(/config\.json/);
    expect(read(dir, 'config.json')).toBe('{"jwtSecret": ');
  });
});

describe('state', () => {
  it('has no last-run version on first run', () => {
    const dir = tempDir();
    loadOrCreateConfig(dir);
    expect(loadState(dir)).toEqual({ lastRunVersion: null });
  });

  it('saveState persists the last-run version durably and touches only state.json', () => {
    const dir = tempDir();
    loadOrCreateConfig(dir);
    const config = read(dir, 'config.json');
    fsCalls.log.length = 0;

    saveState(dir, { lastRunVersion: '0.2.0' });

    expect(fsCalls.log).toEqual([
      'open state.json.tmp',
      'write state.json.tmp',
      'fsync state.json.tmp',
      'close state.json.tmp',
      'rename state.json.tmp -> state.json',
    ]);
    expect(read(dir, 'config.json')).toBe(config);
    expect(loadState(dir)).toEqual({ lastRunVersion: '0.2.0' });
  });

  it('reads the last-run version an older config.json carries, without rewriting it', () => {
    const dir = tempDir();
    const legacy = JSON.stringify({ jwtSecret: 'a'.repeat(64), pgPassword: 'b'.repeat(64), lastRunVersion: '0.1.0' });
    writeFileSync(join(dir, 'config.json'), legacy);

    expect(loadOrCreateConfig(dir)).toEqual({ jwtSecret: 'a'.repeat(64), pgPassword: 'b'.repeat(64) });
    expect(loadState(dir)).toEqual({ lastRunVersion: '0.1.0' });
    expect(fsCalls.log).toEqual([]);

    saveState(dir, { lastRunVersion: '0.2.0' });
    expect(loadState(dir)).toEqual({ lastRunVersion: '0.2.0' });
    expect(read(dir, 'config.json')).toBe(legacy);
  });

  it('treats a damaged state.json as an unknown version, so the next start takes a safety copy', () => {
    const dir = tempDir();
    loadOrCreateConfig(dir);
    writeFileSync(join(dir, 'state.json'), '{"lastRunVersion": ');
    expect(loadState(dir)).toEqual({ lastRunVersion: UNKNOWN_VERSION });
    writeFileSync(join(dir, 'state.json'), '{"lastRunVersion": 3}');
    expect(loadState(dir)).toEqual({ lastRunVersion: UNKNOWN_VERSION });
  });
});
