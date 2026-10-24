// Dev launch only: lays out the local builds the way the packaged app ships them
// (resources/api, resources/web), as directory links, so main.ts finds them unchanged.
//   api -> apps/api/dist/oikos-api                (Task 10: PyInstaller onedir build)
//   web -> apps/web/.next-desktop/standalone      (Task 10: apps/web/scripts/build-desktop.mjs)
// pg_dump is not linked: embedded-postgres does not ship it (see paths.ts).
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(desktop, '..', '..');
const out = join(desktop, '.dev-resources');
const links = {
  api: join(repo, 'apps', 'api', 'dist', 'oikos-api'),
  web: join(repo, 'apps', 'web', '.next-desktop', 'standalone'),
};

mkdirSync(out, { recursive: true });
for (const [name, target] of Object.entries(links)) {
  if (!existsSync(target)) {
    console.error(`dev-resources: missing ${target}. Build it first (see the comment at the top of this file).`);
    process.exit(1);
  }
  const link = join(out, name);
  try {
    if (lstatSync(link)) rmSync(link, { recursive: false, force: true });
  } catch {
    // no link yet
  }
  // Junctions need no admin rights on Windows; elsewhere this is a normal symlink.
  symlinkSync(target, link, 'junction');
  console.log(`dev-resources: ${name} -> ${target}`);
}
