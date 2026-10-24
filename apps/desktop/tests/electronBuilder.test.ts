import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { resolvePaths } from '../src/paths';
// @ts-expect-error: plain ES module script, no type declarations
import { STAGE_DIR } from '../scripts/fetch-pg-dump.mjs';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(desktopDir, '..', '..');
const exe = process.platform === 'win32' ? '.exe' : '';

interface Config {
  appId: string;
  productName: string;
  asar: boolean;
  files: string[];
  directories: { output: string };
  extraResources: { from: string; to: string }[];
  win: { target: { target: string; arch: string[] }[] };
  mac: { identity: null; target: string };
  publish: null;
}
const config = load(readFileSync(join(desktopDir, 'electron-builder.yml'), 'utf8')) as Config;

/** Where electron-builder takes a file shipped at `resources/<path>` from, or null. */
function sourceOf(resourcePath: string): string | null {
  const [top, ...rest] = resourcePath.split(sep);
  const entry = config.extraResources.find((e) => e.to === top);
  return entry ? join(desktopDir, entry.from, ...rest) : null;
}

describe('electron-builder.yml', () => {
  it('names the app as the brief says, unsigned, and never publishes', () => {
    expect(config.appId).toBe('family.oikos.desktop');
    expect(config.productName).toBe('Oikos');
    expect(config.mac.identity).toBeNull();
    expect(config.mac.target).toBe('dmg');
    expect(config.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }]);
    expect(config.publish).toBeNull();
  });

  it('keeps the embedded-postgres binaries out of app.asar so they can be spawned', () => {
    expect(config.asar).toBe(false);
  });

  it('writes installers outside dist/, where tsc puts the app', () => {
    expect(config.directories.output).not.toBe('dist');
    expect(config.files).toContain('dist/**/*.js');
  });

  it('ships every bundled program where resolvePaths looks for it, from where the builds put it', () => {
    const resources = resolve('/res');
    const p = resolvePaths('/data', resources);
    const shipped = (abs: string) => sourceOf(relative(resources, abs));

    expect(shipped(p.apiExe)).toBe(join(repo, 'apps', 'api', 'dist', 'oikos-api', `oikos-api${exe}`));
    expect(shipped(p.alembicIni)).toBe(join(repo, 'apps', 'api', 'dist', 'oikos-api', '_internal', 'alembic.ini'));
    expect(shipped(p.webServerJs)).toBe(
      join(repo, 'apps', 'web', '.next-desktop', 'standalone', 'apps', 'web', 'server.js'),
    );
    expect(shipped(p.pgDumpExe)).toBe(join(STAGE_DIR, 'bin', `pg_dump${exe}`));
  });

  it("ships the web server's node_modules, which electron-builder drops from a `from` folder's root", () => {
    expect(config.extraResources).toContainEqual(
      expect.objectContaining({ from: '../web/.next-desktop/standalone/node_modules', to: 'web/node_modules' }),
    );
  });

  it('ships nothing else as an extra resource', () => {
    expect(config.extraResources.map((e) => e.to).sort()).toEqual(['api', 'postgres', 'web', 'web/node_modules']);
  });
});
