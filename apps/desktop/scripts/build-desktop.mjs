// Builds the installer for the machine it runs on, one step at a time:
//   1. the API exe (scripts/build-api.mjs, PyInstaller)
//   2. the standalone web server (apps/web/scripts/build-desktop.mjs)
//   3. pg_dump from the EDB binaries (scripts/fetch-pg-dump.mjs)
//   4. the Electron main process (tsc)
//   5. electron-builder: release/Oikos Setup <version>.exe on Windows x64,
//      release/Oikos-<version>-<arch>.dmg on macOS (arm64 or x64, the build machine's)
//
// Usage: npm run desktop:build (repo root), or npm run build:desktop (apps/desktop).
// Steps can also run on their own, in this order (CI does this):
//   npm run build:desktop --workspace=@oikos/desktop -- api   (then web, pg-dump, app)
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(desktopDir, '..', '..');
const require = createRequire(join(desktopDir, 'package.json'));

const targets = {
  'win32-x64': ['--win', '--x64'],
  'darwin-arm64': ['--mac', '--arm64'],
  'darwin-x64': ['--mac', '--x64'],
};
const target = targets[`${process.platform}-${process.arch}`];
if (!target) {
  console.error(`build-desktop: no installer target for ${process.platform}-${process.arch}`);
  process.exit(1);
}

function node(script, args = [], cwd = desktopDir) {
  console.log(`\nbuild-desktop: ${script} ${args.join(' ')}`);
  execFileSync(process.execPath, [script, ...args], { cwd, stdio: 'inherit' });
}

const steps = {
  api: () => node(join(desktopDir, 'scripts', 'build-api.mjs')),
  web: () => node(join(repo, 'apps', 'web', 'scripts', 'build-desktop.mjs'), [], join(repo, 'apps', 'web')),
  'pg-dump': () => node(join(desktopDir, 'scripts', 'fetch-pg-dump.mjs')),
  app: () => {
    node(require.resolve('typescript/bin/tsc'), ['-p', 'tsconfig.json']);
    node(require.resolve('electron-builder/cli.js'), ['--config', 'electron-builder.yml', '--publish', 'never', ...target]);
  },
};

const only = process.argv.slice(2);
const unknown = only.filter((name) => !(name in steps));
if (unknown.length) {
  console.error(`build-desktop: unknown step(s) ${unknown.join(', ')}; steps are ${Object.keys(steps).join(', ')}`);
  process.exit(1);
}
for (const [name, step] of Object.entries(steps)) {
  if (only.length === 0 || only.includes(name)) step();
}
