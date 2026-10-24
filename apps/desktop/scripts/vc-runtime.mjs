// Ships the Microsoft Visual C++ runtime next to the bundled PostgreSQL programs on Windows.
//
// postgres.exe, initdb.exe and pg_ctl.exe (embedded-postgres) and pg_dump.exe (EDB) are built with
// MSVC and import VCRUNTIME140.dll (ICU also MSVCP140.dll, which imports VCRUNTIME140_1.dll).
// Neither package ships these, and a clean Windows PC without the VC++ 2015-2022 redistributable
// doesn't have them, so Postgres couldn't start. Windows looks for a DLL in the folder of the
// process's .exe first, so a copy in each bin folder covers the programs and the libraries they load.
// The UCRT (api-ms-win-crt-*, ucrtbase.dll) is part of Windows 10 and 11 and isn't copied.
import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The VC++ runtime DLLs an app may deploy next to its programs. */
export const VC_RUNTIME = /^(vcruntime140(_1)?|msvcp140(_1|_2|_atomic_wait|_codecvt_ids)?|concrt140)\.dll$/i;

/** Names of the DLLs a PE file (.exe or .dll) imports, normal and delay-loaded. */
export function peImports(file) {
  const d = readFileSync(file);
  if (d.length < 0x40 || d.toString('latin1', 0, 2) !== 'MZ') throw new Error(`${file} is not a PE file`);
  const pe = d.readUInt32LE(0x3c);
  if (d.toString('latin1', pe, pe + 4) !== 'PE\0\0') throw new Error(`${file} is not a PE file`);
  const sections = d.readUInt16LE(pe + 6);
  const optSize = d.readUInt16LE(pe + 20);
  const opt = pe + 24;
  const dataDirs = opt + (d.readUInt16LE(opt) === 0x20b ? 112 : 96);
  const table = [];
  for (let i = 0, s = opt + optSize; i < sections; i++, s += 40) {
    table.push({ va: d.readUInt32LE(s + 12), size: Math.max(d.readUInt32LE(s + 8), d.readUInt32LE(s + 16)), raw: d.readUInt32LE(s + 20) });
  }
  const offset = (rva) => {
    const sec = table.find((t) => rva >= t.va && rva < t.va + t.size);
    if (!sec) throw new Error(`${file}: RVA ${rva} is outside every section`);
    return rva - sec.va + sec.raw;
  };
  const cstr = (o) => d.toString('latin1', o, d.indexOf(0, o));

  const names = [];
  // [data directory index, descriptor size, offset of the name RVA in a descriptor]
  for (const [index, size, nameAt] of [[1, 20, 12], [13, 32, 4]]) {
    const rva = d.readUInt32LE(dataDirs + index * 8);
    if (!rva) continue;
    for (let o = offset(rva); ; o += size) {
      const name = d.readUInt32LE(o + nameAt);
      if (!name) break;
      names.push(cstr(offset(name)));
    }
  }
  return names;
}

function peFiles(dir) {
  return readdirSync(dir).filter((f) => /\.(exe|dll)$/i.test(f)).map((f) => join(dir, f));
}

/**
 * The VC++ runtime DLLs needed by every .exe/.dll in `scanDirs`, including what those DLLs
 * themselves import (resolved in `systemDir`). Lower-case names, sorted.
 */
export function vcRuntimeNeeded(scanDirs, systemDir) {
  const needed = new Set();
  const queue = [];
  const add = (imports) => {
    for (const name of imports) {
      const lower = name.toLowerCase();
      if (VC_RUNTIME.test(lower) && !needed.has(lower)) {
        needed.add(lower);
        queue.push(lower);
      }
    }
  };
  for (const dir of scanDirs) for (const file of peFiles(dir)) add(peImports(file));
  while (queue.length) {
    const source = join(systemDir, queue.shift());
    if (!existsSync(source)) throw new Error(`vc-runtime: ${source} is missing on the build machine; install the VC++ 2015-2022 redistributable (x64)`);
    add(peImports(source));
  }
  return [...needed].sort();
}

/**
 * Copies the VC++ runtime DLLs needed by the programs in `scanDirs` from `systemDir` into every
 * folder in `binDirs`, then checks they are all there. Returns the DLL names.
 */
export function bundleVcRuntime({ binDirs, scanDirs, systemDir }) {
  const dlls = vcRuntimeNeeded(scanDirs, systemDir);
  for (const dir of binDirs) {
    for (const dll of dlls) copyFileSync(join(systemDir, dll), join(dir, dll));
  }
  const missing = binDirs.flatMap((dir) => dlls.filter((dll) => !existsSync(join(dir, dll))).map((dll) => join(dir, dll)));
  if (missing.length) throw new Error(`vc-runtime: not bundled: ${missing.join(', ')}`);
  return dlls;
}
