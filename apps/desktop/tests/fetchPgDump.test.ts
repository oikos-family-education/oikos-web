import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error: plain ES module script, no type declarations
import { ensureArchive, PG_VERSION, SOURCES, sha256File, sourceFor, verifySha256 } from '../scripts/fetch-pg-dump.mjs';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const tempDir = () => mkdtempSync(join(tmpdir(), 'Oikos pg_dump João '));

describe('checksum verification', () => {
  it('hashes a file with SHA-256', async () => {
    const file = join(tempDir(), 'a.zip');
    writeFileSync(file, 'hello');
    expect(await sha256File(file)).toBe(sha('hello'));
  });

  it('accepts the expected hash, in either case', async () => {
    const file = join(tempDir(), 'a.zip');
    writeFileSync(file, 'hello');
    await expect(verifySha256(file, sha('hello'))).resolves.toBeUndefined();
    await expect(verifySha256(file, sha('hello').toUpperCase())).resolves.toBeUndefined();
  });

  it('rejects any other content, naming both hashes', async () => {
    const file = join(tempDir(), 'a.zip');
    writeFileSync(file, 'tampered');
    await expect(verifySha256(file, sha('hello'))).rejects.toThrow(
      `checksum mismatch for ${file}: expected ${sha('hello')}, got ${sha('tampered')}`,
    );
  });
});

describe('ensureArchive', () => {
  const source = { url: 'https://get.enterprisedb.com/postgresql/x.zip', sha256: sha('good zip'), files: [], exe: '' };

  it('downloads a missing archive, verifies it and keeps it in the cache', async () => {
    const cache = tempDir();
    const fetchFile = vi.fn(async (_url: string, dest: string) => writeFileSync(dest, 'good zip'));
    const zip = await ensureArchive(source, cache, fetchFile);
    expect(zip).toBe(join(cache, 'x.zip'));
    expect(fetchFile).toHaveBeenCalledWith(source.url, `${zip}.part`);
    expect(readFileSync(zip, 'utf8')).toBe('good zip');
    expect(readdirSync(cache)).toEqual(['x.zip']);
  });

  it('uses a cached archive that passes the checksum without downloading', async () => {
    const cache = tempDir();
    writeFileSync(join(cache, 'x.zip'), 'good zip');
    const fetchFile = vi.fn();
    expect(await ensureArchive(source, cache, fetchFile)).toBe(join(cache, 'x.zip'));
    expect(fetchFile).not.toHaveBeenCalled();
  });

  it('replaces a cached archive that fails the checksum', async () => {
    const cache = tempDir();
    writeFileSync(join(cache, 'x.zip'), 'corrupt');
    const fetchFile = vi.fn(async (_url: string, dest: string) => writeFileSync(dest, 'good zip'));
    await ensureArchive(source, cache, fetchFile);
    expect(fetchFile).toHaveBeenCalledOnce();
    expect(readFileSync(join(cache, 'x.zip'), 'utf8')).toBe('good zip');
  });

  it('rejects a download that fails the checksum and keeps nothing of it', async () => {
    const cache = tempDir();
    const fetchFile = vi.fn(async (_url: string, dest: string) => writeFileSync(dest, 'tampered'));
    await expect(ensureArchive(source, cache, fetchFile)).rejects.toThrow('checksum mismatch');
    expect(existsSync(join(cache, 'x.zip'))).toBe(false);
    expect(readdirSync(cache)).toEqual([]);
  });

  it('keeps nothing of a failed download', async () => {
    const cache = tempDir();
    const fetchFile = vi.fn(async (_url: string, dest: string) => {
      writeFileSync(dest, 'half');
      throw new Error('connection reset');
    });
    await expect(ensureArchive(source, cache, fetchFile)).rejects.toThrow('connection reset');
    expect(readdirSync(cache)).toEqual([]);
  });
});

describe('pinned sources', () => {
  it('matches the PostgreSQL minor that embedded-postgres bundles', () => {
    // Pinned exactly in package.json, e.g. 16.14.0-beta.17 bundles PostgreSQL 16.14
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const version: string = pkg.dependencies['embedded-postgres'];
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
    expect(version.split('.').slice(0, 2).join('.')).toBe(PG_VERSION);
  });

  it('pins an EDB https URL and a SHA-256 for every target', () => {
    for (const key of ['win32-x64', 'darwin-arm64', 'darwin-x64']) {
      const source = SOURCES[key];
      expect(source.url).toMatch(new RegExp(`^https://get\\.enterprisedb\\.com/postgresql/postgresql-${PG_VERSION}-\\d+-`));
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('stages pg_dump where paths.ts looks for it', () => {
    expect(sourceFor('win32', 'x64').files).toContainEqual(['pgsql/bin/pg_dump.exe', 'bin/pg_dump.exe']);
    expect(sourceFor('darwin', 'arm64').files).toContainEqual(['pgsql/bin/pg_dump', 'bin/pg_dump']);
    expect(sourceFor('darwin', 'x64')).toBe(sourceFor('darwin', 'arm64'));
  });

  it('refuses a platform it has no pg_dump for', () => {
    expect(() => sourceFor('linux', 'x64')).toThrow('no pg_dump source for linux-x64');
  });
});
