import { existsSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: plain ES module scripts, no type declarations
import { bundleVcRuntime, peImports, vcRuntimeNeeded, VC_RUNTIME } from '../scripts/vc-runtime.mjs';
// @ts-expect-error: plain ES module scripts, no type declarations
import afterPack, { windowsPostgresDirs } from '../scripts/after-pack.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const native = join(repo, 'node_modules', '@embedded-postgres', 'windows-x64', 'native');
const system32 = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
const onWindows = process.platform === 'win32' && existsSync(native);
const tempDir = () => mkdtempSync(join(tmpdir(), 'Oikos vc João '));

describe('VC_RUNTIME', () => {
  it('matches the redistributable VC++ DLLs and nothing from Windows itself', () => {
    for (const dll of ['VCRUNTIME140.dll', 'vcruntime140_1.dll', 'MSVCP140.dll', 'msvcp140_2.dll', 'concrt140.dll']) {
      expect(VC_RUNTIME.test(dll)).toBe(true);
    }
    for (const dll of ['msvcrt.dll', 'KERNEL32.dll', 'api-ms-win-crt-heap-l1-1-0.dll', 'ucrtbase.dll', 'libpq.dll']) {
      expect(VC_RUNTIME.test(dll)).toBe(false);
    }
  });
});

describe('peImports', () => {
  it('rejects a file that is not a PE image', () => {
    expect(() => peImports(fileURLToPath(import.meta.url))).toThrow('is not a PE file');
  });

  it.skipIf(!onWindows)("reads postgres.exe's imports, including the VC++ runtime", () => {
    const imports = peImports(join(native, 'bin', 'postgres.exe'));
    expect(imports).toContain('KERNEL32.dll');
    expect(imports).toContain('VCRUNTIME140.dll');
  });
});

describe.skipIf(!onWindows)('bundling the VC++ runtime with the embedded-postgres programs', () => {
  it('finds every VC++ DLL they need, transitively (ICU -> MSVCP140 -> VCRUNTIME140_1)', () => {
    expect(vcRuntimeNeeded([join(native, 'bin'), join(native, 'lib')], system32)).toEqual([
      'msvcp140.dll',
      'vcruntime140.dll',
      'vcruntime140_1.dll',
    ]);
  });

  it('copies them into every bin folder', () => {
    const bins = [join(tempDir(), 'server'), join(tempDir(), 'pg_dump')];
    for (const bin of bins) mkdirSync(bin);
    const dlls = bundleVcRuntime({ binDirs: bins, scanDirs: [join(native, 'bin'), join(native, 'lib')], systemDir: system32 });
    expect(dlls).toContain('vcruntime140.dll');
    for (const bin of bins) {
      for (const dll of dlls) expect(existsSync(join(bin, dll))).toBe(true);
    }
  });

  it('fails the build when the build machine lacks a needed DLL', () => {
    const emptySystem = tempDir();
    expect(() =>
      bundleVcRuntime({ binDirs: [tempDir()], scanDirs: [join(native, 'bin')], systemDir: emptySystem }),
    ).toThrow(/vcruntime140\.dll is missing on the build machine/);
  });
});

describe('afterPack', () => {
  it('looks in the packaged embedded-postgres bin and lib folders and in resources/postgres/bin', () => {
    const dirs = windowsPostgresDirs(join('R', 'resources'));
    const pkg = join('R', 'resources', 'app', 'node_modules', '@embedded-postgres', 'windows-x64', 'native');
    expect(dirs.binDirs).toEqual([join(pkg, 'bin'), join('R', 'resources', 'postgres', 'bin')]);
    expect(dirs.scanDirs).toEqual([join(pkg, 'bin'), join(pkg, 'lib'), join('R', 'resources', 'postgres', 'bin')]);
  });

  it('does nothing for a Mac build', async () => {
    const out = tempDir();
    await afterPack({ electronPlatformName: 'darwin', appOutDir: out });
    expect(readdirSync(out)).toEqual([]);
  });
});
