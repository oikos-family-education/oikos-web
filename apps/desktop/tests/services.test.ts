import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../src/config';
import { resolvePaths } from '../src/paths';
import { apiEnv, runMigrations, startApi, startWeb, waitForHealth } from '../src/services';

const { fork } = vi.hoisted(() => ({ fork: vi.fn() }));
vi.mock('electron', () => ({ utilityProcess: { fork } }));

const cfg: AppConfig = { jwtSecret: 'a'.repeat(64), pgPassword: 'b'.repeat(64), lastRunVersion: null };

/** Paths whose "API exe" is node itself: node fails on the `migrate`/`serve` argument like a broken API would. */
function nodeAsApi() {
  const dir = mkdtempSync(join(tmpdir(), 'Oikos João '));
  return { ...resolvePaths(dir, join(dir, 'res')), apiExe: process.execPath };
}

function waitForExit(child: { once(event: 'exit', cb: (code: number | null) => void): unknown }) {
  return new Promise<number | null>((resolve) => child.once('exit', resolve));
}

async function eventuallyRead(file: string, pattern: RegExp): Promise<string> {
  let text = '';
  for (let i = 0; i < 40; i++) {
    try {
      text = readFileSync(file, 'utf8');
      if (pattern.test(text)) return text;
    } catch {
      // not written yet
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return text;
}

describe('apiEnv', () => {
  it('points the API at the local Postgres and the user-data files', () => {
    const paths = resolvePaths('/data', '/res');
    const env = apiEnv(paths, cfg, '0.2.0');
    expect(env).toMatchObject({
      APP_MODE: 'desktop',
      DATABASE_URL: `postgresql+asyncpg://oikos:${'b'.repeat(64)}@127.0.0.1:47323/oikos`,
      DATABASE_SYNC_URL: `postgresql://oikos:${'b'.repeat(64)}@127.0.0.1:47323/oikos`,
      JWT_SECRET_KEY: 'a'.repeat(64),
      SESSIONS_DB_PATH: paths.sessionsDb,
      BACKUP_DIR: paths.backups,
      APP_VERSION: '0.2.0',
      ALEMBIC_INI_PATH: paths.alembicIni,
    });
  });
});

describe('runMigrations', () => {
  it('rejects with the stderr tail and appends the output to migrate.log', async () => {
    const paths = nodeAsApi();
    await expect(runMigrations(paths, { ...process.env })).rejects.toThrow(/Cannot find module/);
    expect(readFileSync(join(paths.logs, 'migrate.log'), 'utf8')).toMatch(/Cannot find module/);
  });
});

describe('startApi', () => {
  it('spawns the API with an argument array and logs to api.log', async () => {
    const paths = nodeAsApi();
    const child = startApi(paths, { ...process.env });
    expect(child.spawnargs.slice(1)).toEqual(['serve', '--port', '47322']);
    expect(await waitForExit(child)).not.toBe(0);
    expect(await eventuallyRead(join(paths.logs, 'api.log'), /Cannot find module/)).toMatch(/Cannot find module/);
  });
});

describe('startWeb', () => {
  it('forks server.js on localhost:47321, IPv4 only, and logs to web.log', async () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    fork.mockReturnValue({ stdout, stderr, once: vi.fn(), on: vi.fn() });
    const dir = mkdtempSync(join(tmpdir(), 'Oikos João '));
    const paths = resolvePaths(dir, join(dir, 'res'));
    mkdirSync(dirname(paths.webServerJs), { recursive: true });
    writeFileSync(paths.webServerJs, '');

    startWeb(paths);

    expect(fork).toHaveBeenCalledWith(
      paths.webServerJs,
      [],
      expect.objectContaining({
        cwd: dirname(paths.webServerJs),
        stdio: 'pipe',
        env: expect.objectContaining({
          PORT: '47321',
          HOSTNAME: 'localhost',
          NODE_ENV: 'production',
          NODE_OPTIONS: expect.stringContaining('--dns-result-order=ipv4first'),
        }),
      }),
    );
    stdout.write('Ready in 120ms\n');
    stderr.write('a warning\n');
    const log = await eventuallyRead(join(paths.logs, 'web.log'), /a warning/);
    expect(log).toContain('Ready in 120ms');
    expect(log).toContain('a warning');
  });
});

describe('waitForHealth', () => {
  it('resolves once the server answers 200', async () => {
    let calls = 0;
    const srv = http.createServer((_req, res) => {
      calls += 1;
      res.statusCode = calls < 3 ? 503 : 200;
      res.end('ok');
    });
    await new Promise<void>((r) => srv.listen(47394, '127.0.0.1', () => r()));
    try {
      await waitForHealth('http://127.0.0.1:47394/health', 10_000);
      expect(calls).toBe(3);
    } finally {
      srv.close();
    }
  });

  it('rejects after the timeout when nothing answers', async () => {
    const started = Date.now();
    await expect(waitForHealth('http://127.0.0.1:47393/health', 1_000)).rejects.toThrow(
      /Timed out.*http:\/\/127\.0\.0\.1:47393\/health/,
    );
    expect(Date.now() - started).toBeLessThan(5_000);
  });
});
