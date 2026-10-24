import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvePaths } from '../src/paths';

const exe = process.platform === 'win32' ? '.exe' : '';

describe('resolvePaths', () => {
  it('puts user data under the user-data folder', () => {
    const p = resolvePaths('/data', '/res');
    expect(p.pgdata).toBe(join('/data', 'pgdata'));
    expect(p.backups).toBe(join('/data', 'backups'));
    expect(p.logs).toBe(join('/data', 'logs'));
    expect(p.sessionsDb).toBe(join('/data', 'sessions.db'));
  });

  it('finds the bundled programs under the resources folder', () => {
    const p = resolvePaths('/data', '/res');
    expect(p.apiExe).toBe(join('/res', 'api', `oikos-api${exe}`));
    expect(p.alembicIni).toBe(join('/res', 'api', '_internal', 'alembic.ini'));
    expect(p.webServerJs).toBe(join('/res', 'web', 'apps', 'web', 'server.js'));
    expect(p.pgDumpExe).toBe(join('/res', 'postgres', 'bin', `pg_dump${exe}`));
  });

  it('paths with spaces and accents survive spawn', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'Oikos João Silva '));
    const p = resolvePaths(dir, '/res');
    const out = execFileSync(process.execPath, ['-e', 'console.log(process.argv[1])', p.backups]).toString().trim();
    expect(out).toBe(p.backups);
  });
});
