import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../src/config';
import { resolvePaths } from '../src/paths';
import { pruneBackups, writePremigrateCopy } from '../src/safetyCopy';

const cfg: AppConfig = { jwtSecret: 'a'.repeat(64), pgPassword: 'b'.repeat(64) };

function stamp(i: number): string {
  return `2026102${i}T120000000Z`;
}

describe('pruneBackups', () => {
  it('pruneBackups keeps the 5 newest per prefix', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oikos backups '));
    for (let i = 1; i <= 7; i++) writeFileSync(join(dir, `auto-premigrate-${stamp(i)}.dump`), 'x');
    for (let i = 1; i <= 2; i++) writeFileSync(join(dir, `auto-prerestore-${stamp(i)}-family.oikos`), 'x');

    const deleted = pruneBackups(dir, 'auto-premigrate-', 5);

    expect(deleted.sort()).toEqual([
      join(dir, `auto-premigrate-${stamp(1)}.dump`),
      join(dir, `auto-premigrate-${stamp(2)}.dump`),
    ]);
    expect(readdirSync(dir).sort()).toEqual([
      ...[3, 4, 5, 6, 7].map((i) => `auto-premigrate-${stamp(i)}.dump`),
      ...[1, 2].map((i) => `auto-prerestore-${stamp(i)}-family.oikos`),
    ]);
  });

  it('deletes nothing when there are fewer files than the limit', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oikos backups '));
    writeFileSync(join(dir, `auto-premigrate-${stamp(1)}.dump`), 'x');
    expect(pruneBackups(dir, 'auto-premigrate-', 5)).toEqual([]);
    expect(readdirSync(dir)).toHaveLength(1);
  });

  it('returns nothing for a backups folder that does not exist yet', () => {
    expect(pruneBackups(join(tmpdir(), 'oikos-no-such-folder-' + Date.now()), 'auto-premigrate-', 5)).toEqual([]);
  });
});

describe('writePremigrateCopy', () => {
  function pathsIn(dir: string, pgDumpExe: string) {
    return { ...resolvePaths(dir, join(dir, 'res')), pgDumpExe };
  }

  it('rejects with the pg_dump error and leaves no partial file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'Oikos João '));
    // node rejects pg_dump's flags ("bad option"), standing in for a failing pg_dump.
    const paths = pathsIn(dir, process.execPath);
    await expect(writePremigrateCopy(paths, cfg)).rejects.toThrow(/bad option/);
    expect(readdirSync(paths.backups)).toEqual([]);
  });

  it('rejects clearly when pg_dump is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oikos '));
    mkdirSync(join(dir, 'backups'));
    const paths = pathsIn(dir, join(dir, 'missing', 'pg_dump.exe'));
    await expect(writePremigrateCopy(paths, cfg)).rejects.toThrow(/pg_dump/);
    expect(readdirSync(paths.backups)).toEqual([]);
  });
});
