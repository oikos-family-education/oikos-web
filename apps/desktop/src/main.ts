import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';
import { loadOrCreateConfig, saveConfig, type AppConfig } from './config.js';
import { logLine } from './logs.js';
import { resolvePaths } from './paths.js';
import { findBusyPorts } from './ports.js';
import { startPostgres, stopOrphanedCluster, type PgHandle } from './postgres.js';
import { writePremigrateCopy } from './safetyCopy.js';
import { apiEnv, runMigrations, startApi, startWeb, stopOrphanedApi, waitForHealth } from './services.js';
import { runStartup, type StartupErrorKind } from './startup.js';
import { createErrorWindow, createMainWindow, createSplash, registerDownloadHandler } from './windows.js';

interface Service {
  name: string;
  kill(): unknown;
  exited: Promise<void>;
}

const STOP_TIMEOUT_MS = 10_000;
/** Quit always completes: whatever is still running after this is killed by the exit handlers. */
const SHUTDOWN_LIMIT_MS = 60_000;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Dev only: keep test runs out of the real user-data folder, and find the local builds.
if (!app.isPackaged && process.env.OIKOS_USER_DATA) app.setPath('userData', process.env.OIKOS_USER_DATA);
const resourcesDir = app.isPackaged
  ? process.resourcesPath
  : (process.env.OIKOS_RESOURCES_DIR ?? join(app.getAppPath(), '.dev-resources'));

let splash: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let errorWindow: BrowserWindow | null = null;
let ready = false;
let quitting = false;
let shutdownDone = false;
let pgStarting: Promise<PgHandle> | null = null;
const services: Service[] = [];

function showError(kind: StartupErrorKind, detail: string, logsDir: string): void {
  if (quitting || errorWindow) return;
  errorWindow = createErrorWindow(kind, detail, logsDir);
  splash?.destroy();
  mainWindow?.destroy();
}

/** Registers a started process so quitting stops it, and reports it dying while the app runs. */
function track<T extends { kill(): unknown; once(event: 'exit', cb: (code: number | null) => void): unknown }>(
  name: string,
  proc: T,
  logsDir: string,
): T {
  let running = true;
  const exited = new Promise<void>((resolve) =>
    proc.once('exit', (code) => {
      running = false;
      resolve();
      if (ready) showError('start', `The ${name} stopped unexpectedly (exit code ${code}).`, logsDir);
    }),
  );
  // Last resort if the app exits before a clean stop (shutdown time limit, crash).
  process.once('exit', () => {
    if (running) proc.kill();
  });
  services.unshift({ name, kill: () => proc.kill(), exited });
  return proc;
}

function refuseWhileQuitting(): void {
  if (quitting) throw new Error('Oikos is closing.');
}

async function start(): Promise<void> {
  registerDownloadHandler();
  const userData = app.getPath('userData');
  const paths = resolvePaths(userData, resourcesDir);
  splash = createSplash();

  let cfg: AppConfig;
  try {
    cfg = loadOrCreateConfig(userData);
  } catch (err) {
    showError('start', (err as Error).message, paths.logs);
    return;
  }
  const env = apiEnv(paths, cfg, app.getVersion());
  let pg: PgHandle | null = null;

  await runStartup({
    cfg,
    appVersion: app.getVersion(),
    stopOrphans: async () => {
      const pgNote = await stopOrphanedCluster(paths);
      if (pgNote) logLine(paths.logs, 'postgres', pgNote);
      const apiNote = await stopOrphanedApi(paths);
      if (apiNote) logLine(paths.logs, 'api', apiNote);
    },
    findBusyPorts,
    startPostgres: async () => {
      refuseWhileQuitting();
      pgStarting = startPostgres(paths, cfg);
      pg = await pgStarting;
    },
    hasUsers: () => pg!.hasUsers(),
    writePremigrateCopy: () => writePremigrateCopy(paths, cfg),
    runMigrations: () => {
      refuseWhileQuitting();
      return runMigrations(paths, env);
    },
    startApi: () => {
      refuseWhileQuitting();
      return track('Oikos API', startApi(paths, env), paths.logs);
    },
    startWeb: () => {
      refuseWhileQuitting();
      return track('Oikos web server', startWeb(paths), paths.logs);
    },
    waitForHealth,
    saveConfig: (next) => saveConfig(userData, next),
    showError: (kind, detail) => showError(kind, detail, paths.logs),
    openMainWindow: () => {
      ready = true;
      mainWindow = createMainWindow();
      mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
        splash?.destroy();
      });
    },
  });
}

/** Web server, then API, then Postgres. */
async function shutdown(): Promise<void> {
  quitting = true;
  for (const win of BrowserWindow.getAllWindows()) win.hide();
  for (const service of services) {
    service.kill();
    await Promise.race([service.exited, delay(STOP_TIMEOUT_MS)]);
  }
  // startPostgres always settles (it has its own start timeout); stop() always settles too.
  const pg = await pgStarting?.catch(() => null);
  await pg?.stop().catch(() => undefined);
}

function focusApp(): void {
  const win = errorWindow ?? mainWindow ?? splash;
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusApp);
  // Ctrl+C in a dev terminal, or a polite kill: take the clean shutdown path.
  process.on('SIGINT', () => app.quit());
  process.on('SIGTERM', () => app.quit());
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', (event) => {
    if (shutdownDone) return;
    event.preventDefault();
    if (quitting) return;
    void Promise.race([shutdown(), delay(SHUTDOWN_LIMIT_MS)]).finally(() => {
      shutdownDone = true;
      app.quit();
    });
  });
  app
    .whenReady()
    .then(start)
    .catch((err) => console.error('Oikos failed to start', err));
}
