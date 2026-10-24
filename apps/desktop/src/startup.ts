import { API_PORT, PG_PORT, WEB_PORT } from './ports.js';

export type StartupErrorKind = 'ports' | 'migration' | 'start';

/** A started service: we only need to notice when it exits. */
export interface WatchedProcess {
  once(event: 'exit', listener: (code: number | null) => void): unknown;
}

/** Every side effect of the startup sequence, injected so the sequence can be tested. */
export interface StartupDeps {
  /** The version that last started successfully (state.json); null on first run. */
  lastRunVersion: string | null;
  appVersion: string;
  /** Stops Postgres and the API if a previous run (a crash, a force-quit) left them running. */
  stopOrphans: () => Promise<void>;
  findBusyPorts: (ports: number[]) => Promise<number[]>;
  startPostgres: () => Promise<unknown>;
  hasUsers: () => Promise<boolean>;
  writePremigrateCopy: () => Promise<string>;
  runMigrations: () => Promise<void>;
  startApi: () => WatchedProcess;
  startWeb: () => WatchedProcess;
  waitForHealth: (url: string, timeoutMs: number) => Promise<void>;
  saveLastRunVersion: (version: string) => void;
  showError: (kind: StartupErrorKind, detail: string) => void;
  openMainWindow: () => void;
}

export const API_HEALTH_URL = `http://127.0.0.1:${API_PORT}/health`;
/** `localhost`, not 127.0.0.1: see startWeb in services.ts. */
export const WEB_URL = `http://localhost:${WEB_PORT}/`;
export const HEALTH_TIMEOUT_MS = 60_000;

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Rejects if the process exits before `healthy` settles. */
function healthyBeforeExit(proc: WatchedProcess, name: string, healthy: Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    proc.once('exit', (code) => reject(new Error(`The ${name} exited before it was ready (exit code ${code}).`)));
    healthy.then(resolve, reject);
  });
}

/**
 * The startup sequence:
 * leftovers of a crashed run → ports → Postgres → safety copy (version change with users) → migrations → API → web
 * → both healthy → record the version → main window. Any failure shows the error window instead.
 */
export async function runStartup(deps: StartupDeps): Promise<void> {
  const { lastRunVersion, appVersion } = deps;
  let stage: StartupErrorKind = 'start';
  try {
    await deps.stopOrphans();
    const busy = await deps.findBusyPorts([WEB_PORT, API_PORT, PG_PORT]);
    if (busy.length > 0) {
      deps.showError('ports', busy.join(', '));
      return;
    }

    await deps.startPostgres();

    let safetyCopy: string | null = null;
    if (lastRunVersion !== null && lastRunVersion !== appVersion && (await deps.hasUsers())) {
      stage = 'migration';
      try {
        safetyCopy = await deps.writePremigrateCopy();
      } catch (err) {
        throw new Error(`The safety copy could not be written, so the update was not started: ${message(err)}`);
      }
    }

    stage = 'migration';
    try {
      await deps.runMigrations();
    } catch (err) {
      throw new Error(safetyCopy ? `${message(err)}\n\nSafety copy of your data: ${safetyCopy}` : message(err));
    }

    stage = 'start';
    const api = deps.startApi();
    const web = deps.startWeb();
    await Promise.all([
      healthyBeforeExit(api, 'Oikos API', deps.waitForHealth(API_HEALTH_URL, HEALTH_TIMEOUT_MS)),
      healthyBeforeExit(web, 'Oikos web server', deps.waitForHealth(WEB_URL, HEALTH_TIMEOUT_MS)),
    ]);

    if (lastRunVersion !== appVersion) deps.saveLastRunVersion(appVersion);
    deps.openMainWindow();
  } catch (err) {
    deps.showError(stage, message(err));
  }
}
