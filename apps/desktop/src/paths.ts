import { join } from 'node:path';

export interface AppPaths {
  userData: string;
  pgdata: string;
  backups: string;
  logs: string;
  sessionsDb: string;
  apiExe: string;
  alembicIni: string;
  webServerJs: string;
  pgDumpExe: string;
}

/**
 * Where everything lives.
 *
 * `userDataDir` holds the family's data. `resourcesDir` holds the bundled programs:
 * - `api/`: the PyInstaller onedir build (`apps/api/dist/oikos-api`)
 * - `web/`: the Next.js standalone folder (`apps/web/.next-desktop/standalone`)
 * - `postgres/bin/`: PostgreSQL client tools (`pg_dump`)
 */
export function resolvePaths(userDataDir: string, resourcesDir: string): AppPaths {
  const exe = process.platform === 'win32' ? '.exe' : '';
  return {
    userData: userDataDir,
    pgdata: join(userDataDir, 'pgdata'),
    backups: join(userDataDir, 'backups'),
    logs: join(userDataDir, 'logs'),
    sessionsDb: join(userDataDir, 'sessions.db'),
    apiExe: join(resourcesDir, 'api', `oikos-api${exe}`),
    alembicIni: join(resourcesDir, 'api', '_internal', 'alembic.ini'),
    webServerJs: join(resourcesDir, 'web', 'apps', 'web', 'server.js'),
    pgDumpExe: join(resourcesDir, 'postgres', 'bin', `pg_dump${exe}`),
  };
}
