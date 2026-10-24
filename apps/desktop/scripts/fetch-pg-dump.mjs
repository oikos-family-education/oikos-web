// Stages pg_dump, and the libraries it loads, into .pg-dump/ for electron-builder, which ships
// that folder as resources/postgres (see paths.ts: postgres/bin/pg_dump[.exe]).
//
// embedded-postgres ships only initdb, pg_ctl and postgres, so pg_dump comes from the official
// EnterpriseDB PostgreSQL binary zips. Same minor as the bundled server (pg_dump must be at least
// the server's version). The zip is downloaded once into .cache/pg-dump/ and checked against a
// pinned SHA-256 before anything is extracted.
//
// Usage (from apps/desktop): node scripts/fetch-pg-dump.mjs
// Builds for the machine it runs on: win32-x64, darwin-arm64 or darwin-x64.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, copyFileSync, chmodSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The PostgreSQL minor of the server embedded-postgres bundles (16.14.0-beta.17 is 16.14). */
export const PG_VERSION = '16.14';
export const CACHE_DIR = join(desktopDir, '.cache', 'pg-dump');
/** electron-builder ships this folder as resources/postgres (electron-builder.yml). */
export const STAGE_DIR = join(desktopDir, '.pg-dump');

// Each file is [path in the zip, path under STAGE_DIR]. Only regular files are taken: the macOS
// zip has symlinks such as lib/libz.1.dylib -> libz.1.3.2.dylib, so the real file is copied under
// the name pg_dump loads. The lists are pg_dump's dependency closure (PE imports / Mach-O
// LC_LOAD_DYLIB), leaving out what the OS provides.
const WINDOWS = {
  url: `https://get.enterprisedb.com/postgresql/postgresql-${PG_VERSION}-2-windows-x64-binaries.zip`,
  sha256: '8a7f54c1968d5d49bdcd3f66b1291f736c74b8cb6a26e9874771fcc7837dbf38',
  files: [
    'pg_dump.exe',
    'libpq.dll',
    'libssl-3-x64.dll',
    'libcrypto-3-x64.dll',
    'libintl-9.dll',
    'libiconv-2.dll',
    'libwinpthread-1.dll',
    'zlib1.dll',
    'liblz4.dll',
    'libzstd.dll',
  ].map((f) => [`pgsql/bin/${f}`, `bin/${f}`]),
  exe: 'bin/pg_dump.exe',
};

// One universal (arm64 + x86_64) zip serves both Mac builds. pg_dump loads @loader_path/../lib/*.
const MACOS = {
  url: `https://get.enterprisedb.com/postgresql/postgresql-${PG_VERSION}-2-osx-binaries.zip`,
  sha256: 'b5b7f920470fdcc4f4c8029c6da30fda64c11caf0b14e75674684356443f4bbe',
  files: [
    ['pgsql/bin/pg_dump', 'bin/pg_dump'],
    ...[
      'libpq.5.dylib',
      'libssl.3.dylib',
      'libcrypto.3.dylib',
      'libgssapi_krb5.2.2.dylib',
      'libkrb5.3.3.dylib',
      'libk5crypto.3.1.dylib',
      'libcom_err.3.0.dylib',
      'libkrb5support.1.1.dylib',
    ].map((f) => [`pgsql/lib/${f}`, `lib/${f}`]),
    ['pgsql/lib/libz.1.3.2.dylib', 'lib/libz.1.dylib'],
    ['pgsql/lib/liblz4.1.10.0.dylib', 'lib/liblz4.1.dylib'],
    ['pgsql/lib/libzstd.1.5.7.dylib', 'lib/libzstd.1.dylib'],
  ],
  exe: 'bin/pg_dump',
};

export const SOURCES = {
  'win32-x64': WINDOWS,
  'darwin-arm64': MACOS,
  'darwin-x64': MACOS,
};

export function sourceFor(platform = process.platform, arch = process.arch) {
  const source = SOURCES[`${platform}-${arch}`];
  if (!source) throw new Error(`fetch-pg-dump: no pg_dump source for ${platform}-${arch}`);
  return source;
}

export async function sha256File(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

/** Throws, naming both hashes, unless the file's SHA-256 is `expected`. */
export async function verifySha256(path, expected) {
  const actual = await sha256File(path);
  if (actual !== expected.toLowerCase()) {
    throw new Error(`fetch-pg-dump: checksum mismatch for ${path}: expected ${expected}, got ${actual}`);
  }
}

export async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`fetch-pg-dump: download failed: ${url} -> HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

/**
 * Returns the path of the cached zip, downloading it when missing. A cached file that fails the
 * checksum is replaced once; a download that fails it is deleted and rejected.
 */
export async function ensureArchive(source, cacheDir = CACHE_DIR, fetchFile = download) {
  mkdirSync(cacheDir, { recursive: true });
  const zip = join(cacheDir, new URL(source.url).pathname.split('/').pop());
  if (existsSync(zip)) {
    try {
      await verifySha256(zip, source.sha256);
      return zip;
    } catch (err) {
      console.warn(`${err.message}; downloading it again`);
      rmSync(zip, { force: true });
    }
  }
  const part = `${zip}.part`;
  rmSync(part, { force: true });
  console.log(`fetch-pg-dump: downloading ${source.url}`);
  try {
    await fetchFile(source.url, part);
    await verifySha256(part, source.sha256);
  } catch (err) {
    rmSync(part, { force: true });
    throw err;
  }
  renameSync(part, zip);
  return zip;
}

/** bsdtar reads zips: built into Windows 10+ (System32) and macOS. GNU tar (Git Bash) can't. */
function tarCommand() {
  if (process.platform === 'win32') return join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  return 'tar';
}

/** Extracts `source.files` from the verified zip into a fresh stageDir, then runs pg_dump --version. */
export async function stagePgDump({ platform = process.platform, arch = process.arch, cacheDir = CACHE_DIR, stageDir = STAGE_DIR } = {}) {
  const source = sourceFor(platform, arch);
  const zip = await ensureArchive(source, cacheDir);

  const tmp = mkdtempSync(join(cacheDir, 'extract-'));
  try {
    execFileSync(tarCommand(), ['-xf', zip, '-C', tmp, ...source.files.map(([from]) => from)], { stdio: 'inherit' });
    rmSync(stageDir, { recursive: true, force: true });
    for (const [from, to] of source.files) {
      const dest = join(stageDir, to);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(join(tmp, from), dest);
      if (platform !== 'win32') chmodSync(dest, 0o755);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const exe = join(stageDir, source.exe);
  const version = execFileSync(exe, ['--version']).toString().trim();
  if (version !== `pg_dump (PostgreSQL) ${PG_VERSION}`) {
    throw new Error(`fetch-pg-dump: ${exe} reports "${version}", expected PostgreSQL ${PG_VERSION}`);
  }
  console.log(`fetch-pg-dump: ${exe} (${version})`);
  return exe;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  stagePgDump().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
