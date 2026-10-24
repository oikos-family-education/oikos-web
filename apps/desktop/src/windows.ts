import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow, session, shell } from 'electron';
import { WEB_PORT } from './ports.js';
import { WEB_URL, type StartupErrorKind } from './startup.js';

const APP_ORIGINS = new Set([`http://localhost:${WEB_PORT}`, `http://127.0.0.1:${WEB_PORT}`]);
/** Links on the error page; intercepted in will-navigate, never loaded. */
const ACTION_URL = 'http://oikos.invalid/';

const STRINGS = {
  en: {
    starting: 'Starting Oikos…',
    startingHint: 'This can take a moment the first time.',
    portsTitle: 'Oikos can’t start: a port it needs is in use',
    portsBody: 'Another program is using port(s) {detail}. Close it or restart your computer, then open Oikos again.',
    migrationTitle: 'Oikos couldn’t update its database',
    migrationBody: 'Your data has not been changed. Please send the log folder to the person who installed Oikos.',
    startTitle: 'Oikos couldn’t start',
    startBody: 'Please try again. If it keeps happening, send the log folder to the person who installed Oikos.',
    openLogs: 'Open log folder',
    quit: 'Quit',
    saveBackup: 'Save backup',
    backupFiles: 'Oikos backup',
  },
  pt: {
    starting: 'Iniciando o Oikos…',
    startingHint: 'Na primeira vez isso pode levar um momento.',
    portsTitle: 'O Oikos não pode iniciar: uma porta necessária está em uso',
    portsBody: 'Outro programa está usando a(s) porta(s) {detail}. Feche-o ou reinicie o computador e abra o Oikos novamente.',
    migrationTitle: 'O Oikos não conseguiu atualizar o banco de dados',
    migrationBody: 'Seus dados não foram alterados. Envie a pasta de logs para quem instalou o Oikos.',
    startTitle: 'O Oikos não conseguiu iniciar',
    startBody: 'Tente novamente. Se continuar acontecendo, envie a pasta de logs para quem instalou o Oikos.',
    openLogs: 'Abrir pasta de logs',
    quit: 'Sair',
    saveBackup: 'Salvar backup',
    backupFiles: 'Backup do Oikos',
  },
};

function strings() {
  return app.getLocale().toLowerCase().startsWith('pt') ? STRINGS.pt : STRINGS.en;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, "Segoe UI", system-ui, -apple-system, sans-serif;
         background: #f8fafc; color: #475569; -webkit-user-select: none; user-select: none; }
  h1 { color: #1e293b; }
  @media (prefers-color-scheme: dark) { body { background: #0f172a; color: #cbd5e1; } h1 { color: #f1f5f9; } }
`;

function page(body: string, css: string): string {
  const html = `<!doctype html><html><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
    <style>${BASE_CSS}${css}</style></head><body>${body}</body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/** The loading screen shown while Postgres, the API and the web server start. */
export function createSplash(): BrowserWindow {
  const t = strings();
  const win = new BrowserWindow({
    width: 420,
    height: 280,
    frame: false,
    resizable: false,
    show: false,
    title: 'Oikos',
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  win.once('ready-to-show', () => win.show());
  void win.loadURL(
    page(
      `<main><div class="spinner"></div><h1>${escapeHtml(t.starting)}</h1><p>${escapeHtml(t.startingHint)}</p></main>`,
      `main { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; }
       h1 { font-size: 18px; font-weight: 600; margin: 20px 0 4px; }
       p { font-size: 13px; color: #64748b; margin: 0; }
       .spinner { width: 40px; height: 40px; border-radius: 50%; border: 4px solid #e0e7ff; border-top-color: #6366f1; animation: spin 0.9s linear infinite; }
       @keyframes spin { to { transform: rotate(360deg); } }`,
    ),
  );
  return win;
}

/** The error screen, with "Open log folder" and "Quit". */
export function createErrorWindow(kind: StartupErrorKind, detail: string, logsDir: string): BrowserWindow {
  const t = strings();
  const [title, body] = {
    ports: [t.portsTitle, t.portsBody.replace('{detail}', detail)],
    migration: [t.migrationTitle, t.migrationBody],
    start: [t.startTitle, t.startBody],
  }[kind];
  const win = new BrowserWindow({
    width: 620,
    height: 460,
    minWidth: 420,
    minHeight: 320,
    title: 'Oikos',
    autoHideMenuBar: true,
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  win.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    if (url === `${ACTION_URL}open-logs`) {
      mkdirSync(logsDir, { recursive: true });
      void shell.openPath(logsDir);
    }
    if (url === `${ACTION_URL}quit`) app.quit();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const details = kind === 'ports' ? '' : `<pre>${escapeHtml(detail)}</pre>`;
  void win.loadURL(
    page(
      `<main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p>${details}
       <div class="actions"><a class="secondary" href="${ACTION_URL}open-logs">${escapeHtml(t.openLogs)}</a>
       <a class="primary" href="${ACTION_URL}quit">${escapeHtml(t.quit)}</a></div></main>`,
      `main { padding: 32px; display: flex; flex-direction: column; height: 100vh; }
       h1 { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
       p { margin: 0 0 16px; line-height: 1.5; }
       pre { flex: 1; overflow: auto; margin: 0 0 20px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 12px;
             background: #fff; color: #334155; font-size: 12px; white-space: pre-wrap; word-break: break-word; user-select: text; -webkit-user-select: text; }
       .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: auto; }
       a { display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; padding: 10px 18px;
           border-radius: 12px; font-weight: 600; font-size: 14px; text-decoration: none; }
       .primary { background: #6366f1; color: #fff; } .primary:hover { background: #4f46e5; }
       .secondary { border: 1px solid #e2e8f0; color: #334155; background: #fff; } .secondary:hover { background: #f1f5f9; }
       @media (prefers-color-scheme: dark) { pre, .secondary { background: #1e293b; color: #e2e8f0; border-color: #334155; } }`,
    ),
  );
  return win;
}

function isAppUrl(url: string): boolean {
  try {
    return APP_ORIGINS.has(new URL(url).origin);
  } catch {
    return false;
  }
}

function openOutside(url: string): void {
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) void shell.openExternal(url);
}

/** The app itself. Links that leave the local app open in the system browser. */
export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Oikos',
    autoHideMenuBar: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openOutside(url);
  });
  void win.loadURL(WEB_URL);
  return win;
}

/** Downloads (the backup file) ask where to save with the native Save dialog. */
export function registerDownloadHandler(): void {
  session.defaultSession.on('will-download', (_event, item) => {
    const t = strings();
    const filename = item.getFilename();
    item.setSaveDialogOptions({
      title: t.saveBackup,
      defaultPath: join(app.getPath('documents'), filename),
      filters: filename.endsWith('.oikos') ? [{ name: t.backupFiles, extensions: ['oikos'] }] : [],
    });
  });
}
