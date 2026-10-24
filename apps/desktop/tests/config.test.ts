import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOrCreateConfig, saveConfig } from '../src/config';

describe('config', () => {
  it('loadOrCreateConfig creates once and then reuses', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oikos '));
    const a = loadOrCreateConfig(dir);
    const b = loadOrCreateConfig(dir);
    expect(a.jwtSecret).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toEqual(a);
  });

  it('generates two independent secrets and no last-run version', () => {
    const cfg = loadOrCreateConfig(mkdtempSync(join(tmpdir(), 'oikos ')));
    expect(cfg.pgPassword).toMatch(/^[0-9a-f]{64}$/);
    expect(cfg.pgPassword).not.toBe(cfg.jwtSecret);
    expect(cfg.lastRunVersion).toBeNull();
  });

  it('creates the user-data folder when it does not exist yet', () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'oikos ')), 'nested', 'Oikos');
    loadOrCreateConfig(dir);
    expect(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')).jwtSecret).toMatch(/^[0-9a-f]{64}$/);
  });

  it('saveConfig persists the last-run version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oikos '));
    const cfg = loadOrCreateConfig(dir);
    saveConfig(dir, { ...cfg, lastRunVersion: '0.2.0' });
    expect(loadOrCreateConfig(dir)).toEqual({ ...cfg, lastRunVersion: '0.2.0' });
  });

  it('refuses a damaged config instead of replacing the secrets', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oikos '));
    writeFileSync(join(dir, 'config.json'), '{"jwtSecret": ');
    expect(() => loadOrCreateConfig(dir)).toThrow(/config\.json/);
    expect(readFileSync(join(dir, 'config.json'), 'utf8')).toBe('{"jwtSecret": ');
  });
});
