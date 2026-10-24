import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../src/config';
import { runStartup, type StartupDeps } from '../src/startup';

const cfg: AppConfig = { jwtSecret: 'a'.repeat(64), pgPassword: 'b'.repeat(64), lastRunVersion: '0.2.0' };

function fakeDeps(overrides: Partial<StartupDeps> = {}) {
  const calls: string[] = [];
  const step = <T>(name: string, result: T) =>
    vi.fn(async () => {
      calls.push(name);
      return result;
    });
  const deps = {
    cfg,
    appVersion: '0.2.0',
    stopOrphans: step('stopOrphans', undefined),
    findBusyPorts: vi.fn(async (_ports: number[]) => {
      calls.push('findBusyPorts');
      return [] as number[];
    }),
    startPostgres: step('startPostgres', undefined),
    hasUsers: step('hasUsers', true),
    writePremigrateCopy: step('writePremigrateCopy', '/data/backups/auto-premigrate-x.dump'),
    runMigrations: step('runMigrations', undefined),
    startApi: vi.fn(() => {
      calls.push('startApi');
      return new EventEmitter();
    }),
    startWeb: vi.fn(() => {
      calls.push('startWeb');
      return new EventEmitter();
    }),
    waitForHealth: vi.fn(async (url: string, _timeoutMs: number) => {
      calls.push(`waitForHealth ${url}`);
    }),
    saveConfig: vi.fn((_cfg: AppConfig) => {
      calls.push('saveConfig');
    }),
    showError: vi.fn((_kind: 'ports' | 'migration' | 'start', _detail: string) => {
      calls.push('showError');
    }),
    openMainWindow: vi.fn(() => {
      calls.push('openMainWindow');
    }),
    ...overrides,
  };
  return Object.assign(deps, { calls });
}

describe('runStartup', () => {
  it('runStartup runs steps in order and records the version', async () => {
    const deps = fakeDeps({ cfg: { ...cfg, lastRunVersion: '0.1.0' } });
    await runStartup(deps);
    expect(deps.calls).toEqual([
      'stopOrphans',
      'findBusyPorts',
      'startPostgres',
      'hasUsers',
      'writePremigrateCopy',
      'runMigrations',
      'startApi',
      'startWeb',
      'waitForHealth http://127.0.0.1:47322/health',
      'waitForHealth http://localhost:47321/',
      'saveConfig',
      'openMainWindow',
    ]);
    expect(deps.findBusyPorts).toHaveBeenCalledWith([47321, 47322, 47323]);
    expect(deps.waitForHealth).toHaveBeenCalledWith('http://127.0.0.1:47322/health', 60_000);
    expect(deps.waitForHealth).toHaveBeenCalledWith('http://localhost:47321/', 60_000);
    expect(deps.saveConfig).toHaveBeenCalledWith({ ...cfg, lastRunVersion: '0.2.0' });
    expect(deps.showError).not.toHaveBeenCalled();
  });

  it('startup aborts before migrating when the safety copy fails', async () => {
    const deps = fakeDeps({
      cfg: { ...cfg, lastRunVersion: '0.1.0' },
      appVersion: '0.2.0',
      hasUsers: async () => true,
      writePremigrateCopy: async () => {
        throw new Error('disk full');
      },
    });
    await runStartup(deps);
    expect(deps.runMigrations).not.toHaveBeenCalled();
    expect(deps.showError).toHaveBeenCalledWith('migration', expect.stringContaining('disk full'));
    expect(deps.startApi).not.toHaveBeenCalled();
    expect(deps.saveConfig).not.toHaveBeenCalled();
  });

  it('a failure to clear a previous run shows the start error and starts nothing', async () => {
    const deps = fakeDeps({
      stopOrphans: async () => {
        throw new Error('pg_ctl stop failed');
      },
    });
    await runStartup(deps);
    expect(deps.showError).toHaveBeenCalledWith('start', expect.stringContaining('pg_ctl stop failed'));
    expect(deps.findBusyPorts).not.toHaveBeenCalled();
    expect(deps.startPostgres).not.toHaveBeenCalled();
  });

  it('busy ports show the ports error and start nothing', async () => {
    const deps = fakeDeps({ findBusyPorts: async () => [47322] });
    await runStartup(deps);
    expect(deps.showError).toHaveBeenCalledWith('ports', '47322');
    expect(deps.startPostgres).not.toHaveBeenCalled();
    expect(deps.openMainWindow).not.toHaveBeenCalled();
  });

  it('no safety copy on first run or same version', async () => {
    const firstRun = fakeDeps({ cfg: { ...cfg, lastRunVersion: null } });
    await runStartup(firstRun);
    expect(firstRun.writePremigrateCopy).not.toHaveBeenCalled();
    expect(firstRun.runMigrations).toHaveBeenCalled();
    expect(firstRun.saveConfig).toHaveBeenCalledWith({ ...cfg, lastRunVersion: '0.2.0' });

    const sameVersion = fakeDeps({ cfg: { ...cfg, lastRunVersion: '0.2.0' } });
    await runStartup(sameVersion);
    expect(sameVersion.writePremigrateCopy).not.toHaveBeenCalled();
    expect(sameVersion.runMigrations).toHaveBeenCalled();
  });

  it('no safety copy after an upgrade when the database has no users', async () => {
    const deps = fakeDeps({ cfg: { ...cfg, lastRunVersion: '0.1.0' }, hasUsers: async () => false });
    await runStartup(deps);
    expect(deps.writePremigrateCopy).not.toHaveBeenCalled();
    expect(deps.runMigrations).toHaveBeenCalled();
  });

  it('a failed migration names the safety copy and starts nothing else', async () => {
    const deps = fakeDeps({
      cfg: { ...cfg, lastRunVersion: '0.1.0' },
      runMigrations: async () => {
        throw new Error('alembic: relation "x" does not exist');
      },
    });
    await runStartup(deps);
    expect(deps.showError).toHaveBeenCalledWith('migration', expect.stringContaining('relation "x" does not exist'));
    expect(deps.showError).toHaveBeenCalledWith(
      'migration',
      expect.stringContaining('/data/backups/auto-premigrate-x.dump'),
    );
    expect(deps.startApi).not.toHaveBeenCalled();
    expect(deps.saveConfig).not.toHaveBeenCalled();
  });

  it('a Postgres start failure shows the start error', async () => {
    const deps = fakeDeps({
      startPostgres: async () => {
        throw new Error('initdb failed');
      },
    });
    await runStartup(deps);
    expect(deps.showError).toHaveBeenCalledWith('start', expect.stringContaining('initdb failed'));
    expect(deps.runMigrations).not.toHaveBeenCalled();
  });

  it('a health-check timeout shows the start error and keeps the old version', async () => {
    const deps = fakeDeps({
      cfg: { ...cfg, lastRunVersion: '0.1.0' },
      waitForHealth: async (url: string) => {
        if (url.includes('47321')) throw new Error(`Timed out waiting for ${url}`);
      },
    });
    await runStartup(deps);
    expect(deps.showError).toHaveBeenCalledWith('start', expect.stringContaining('Timed out waiting for http://localhost:47321/'));
    expect(deps.saveConfig).not.toHaveBeenCalled();
    expect(deps.openMainWindow).not.toHaveBeenCalled();
  });

  it('an API that exits before it is healthy shows the start error without waiting for the timeout', async () => {
    const api = new EventEmitter();
    const deps = fakeDeps({
      startApi: () => {
        setTimeout(() => api.emit('exit', 2), 5);
        return api;
      },
      waitForHealth: () => new Promise<void>(() => {}),
    });
    await runStartup(deps);
    expect(deps.showError).toHaveBeenCalledWith('start', expect.stringMatching(/API.*exited.*2/));
    expect(deps.openMainWindow).not.toHaveBeenCalled();
  });
});
