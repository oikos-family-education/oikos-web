import { spawn } from 'node:child_process';
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAlive, killTree, processImage, waitForExit } from '../src/processes';

function sleeper() {
  return spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
}

describe('processes', () => {
  it('sees a live process, names its program, kills it and sees it gone', async () => {
    const child = sleeper();
    const pid = child.pid!;
    try {
      expect(isAlive(pid)).toBe(true);
      expect(basename((await processImage(pid))!).toLowerCase()).toBe(basename(process.execPath).toLowerCase());
      killTree(pid);
      expect(await waitForExit(pid, 10_000)).toBe(true);
      expect(isAlive(pid)).toBe(false);
      expect(await processImage(pid)).toBeNull();
    } finally {
      child.kill();
    }
  });

  it('waitForExit gives up on a process that keeps running', async () => {
    const child = sleeper();
    try {
      expect(await waitForExit(child.pid!, 300)).toBe(false);
    } finally {
      child.kill();
    }
  });
});
