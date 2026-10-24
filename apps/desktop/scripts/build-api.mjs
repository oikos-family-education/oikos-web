// Builds the API exe with PyInstaller into apps/api/dist/oikos-api/ (apps/api/desktop/oikos-api.spec),
// using a dedicated venv at apps/api/.venv-desktop.
//
// Python 3.12 comes from OIKOS_PYTHON when set (CI passes setup-python's python-path), otherwise
// `py -3.12` on Windows and `python3.12` elsewhere.
//
// Usage: node scripts/build-api.mjs
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const apiDir = join(repo, 'apps', 'api');
const venv = join(apiDir, '.venv-desktop');
const isWindows = process.platform === 'win32';
const venvPython = isWindows ? join(venv, 'Scripts', 'python.exe') : join(venv, 'bin', 'python');
const exe = join(apiDir, 'dist', 'oikos-api', isWindows ? 'oikos-api.exe' : 'oikos-api');

function run(cmd, args) {
  console.log(`build-api: ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd: apiDir, stdio: 'inherit' });
}

function basePython() {
  if (process.env.OIKOS_PYTHON) return [process.env.OIKOS_PYTHON];
  return isWindows ? ['py', '-3.12'] : ['python3.12'];
}

if (!existsSync(venvPython)) {
  const [cmd, ...pre] = basePython();
  run(cmd, [...pre, '-m', 'venv', venv]);
}
const version = execFileSync(venvPython, ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])']).toString().trim();
if (version !== '3.12') {
  console.error(`build-api: ${venv} uses Python ${version}; delete it and build with Python 3.12`);
  process.exit(1);
}

run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', 'requirements-desktop.txt']);
run(venvPython, ['-m', 'PyInstaller', join('desktop', 'oikos-api.spec'), '--noconfirm']);

if (!existsSync(exe)) {
  console.error(`build-api: ${exe} was not produced`);
  process.exit(1);
}
console.log(`build-api: ${exe}`);
