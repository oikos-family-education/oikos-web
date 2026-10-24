// Builds the web app for the desktop installer: a standalone Next.js server that Electron runs
// with its own Node on 127.0.0.1:47321, proxying /api to the bundled API on 127.0.0.1:47322.
//
// Usage (from apps/web): node scripts/build-desktop.mjs
// Output: .next-desktop/standalone/apps/web/server.js, with its static assets next to it.
//
// Run it with PORT=47321, HOSTNAME=localhost and Node's --dns-result-order=ipv4first (it then listens
// on 127.0.0.1 only). Not HOSTNAME=127.0.0.1: Next 14 renames 127.0.0.1 to localhost in the URLs
// middleware sees, so the locale rewrites would no longer match the server's own origin and every
// page would redirect to itself.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Not .next: the Docker dev server serves that folder through its bind mount
const distDir = '.next-desktop';
const distPath = path.join(webDir, distDir);
// The standalone folder mirrors the monorepo layout (next.config.js traces from the repo root)
const appDir = path.join(distPath, 'standalone', 'apps', 'web');

const env = {
  ...process.env,
  NEXT_PUBLIC_APP_MODE: 'desktop',
  NEXT_OUTPUT_STANDALONE: '1',
  API_URL: 'http://127.0.0.1:47322',
  NEXT_DIST_DIR: distDir,
  NEXT_TELEMETRY_DISABLED: '1',
};

// next build adds "<distDir>/types/**/*.ts" to tsconfig.json; keep the checked-in file as it is
const tsconfigPath = path.join(webDir, 'tsconfig.json');
const tsconfig = readFileSync(tsconfigPath, 'utf8');

rmSync(distPath, { recursive: true, force: true });

const nextBin = createRequire(path.join(webDir, 'package.json')).resolve('next/dist/bin/next');
let result;
try {
  result = spawnSync(process.execPath, [nextBin, 'build'], { cwd: webDir, env, stdio: 'inherit' });
} finally {
  writeFileSync(tsconfigPath, tsconfig);
}
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

if (!existsSync(path.join(appDir, 'server.js'))) {
  console.error(`build-desktop: ${path.join(appDir, 'server.js')} was not produced`);
  process.exit(1);
}

// The standalone server doesn't include the static assets; it serves them from beside server.js
cpSync(path.join(distPath, 'static'), path.join(appDir, distDir, 'static'), { recursive: true });
const publicDir = path.join(webDir, 'public');
if (existsSync(publicDir)) {
  cpSync(publicDir, path.join(appDir, 'public'), { recursive: true });
}

console.log(`build-desktop: ${path.join(appDir, 'server.js')}`);
