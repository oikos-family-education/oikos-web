// electron-builder afterPack hook (electron-builder.yml): runs on the unpacked app before the
// installer is made. On Windows it bundles the VC++ runtime next to the PostgreSQL programs
// (see vc-runtime.mjs). macOS needs nothing here: electron-builder ad-hoc signs (mac.identity "-").
import { join } from 'node:path';
import { bundleVcRuntime } from './vc-runtime.mjs';

/** Where the bundled PostgreSQL programs are in a packaged Windows app (`resources` folder). */
export function windowsPostgresDirs(resourcesDir) {
  const native = join(resourcesDir, 'app', 'node_modules', '@embedded-postgres', 'windows-x64', 'native');
  const server = join(native, 'bin');
  const pgDump = join(resourcesDir, 'postgres', 'bin');
  return {
    binDirs: [server, pgDump],
    // lib/ holds the extension DLLs postgres.exe loads; they resolve the runtime from bin/
    scanDirs: [server, join(native, 'lib'), pgDump],
  };
}

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const systemDir = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
  const dlls = bundleVcRuntime({ ...windowsPostgresDirs(join(context.appOutDir, 'resources')), systemDir });
  console.log(`  • after-pack: bundled the VC++ runtime (${dlls.join(', ')}) with postgres and pg_dump`);
}
