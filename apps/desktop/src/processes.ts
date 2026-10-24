import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** True while a process with this PID exists. */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/** The program a PID is running (Windows: image name; elsewhere: command path), or null when it is gone. */
export async function processImage(pid: number): Promise<string | null> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { windowsHide: true });
      const match = /^"([^"]+)","(\d+)"/m.exec(stdout);
      return match && Number(match[2]) === pid ? match[1] : null;
    }
    const { stdout } = await execFileAsync('ps', ['-p', String(pid), '-o', 'comm=']);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/** Forcefully ends a process and its children. */
export function killTree(pid: number): void {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/f', '/t'], { windowsHide: true });
  } else {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
}

/** Resolves true once the process is gone, false if it is still running after `timeoutMs`. */
export async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (isAlive(pid)) {
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, 100));
  }
  return true;
}
