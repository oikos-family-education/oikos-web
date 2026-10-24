import { appendFileSync, createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';
type Readable = NodeJS.ReadableStream;

/** Opens `<logsDir>/<name>.log` for appending, with a header marking this run. */
export function openLog(logsDir: string, name: string): WriteStream {
  mkdirSync(logsDir, { recursive: true });
  const stream = createWriteStream(join(logsDir, `${name}.log`), { flags: 'a' });
  // A log that cannot be written (disk full, late write) must never take the app down.
  stream.on('error', () => undefined);
  stream.write(`\n=== ${new Date().toISOString()} ===\n`);
  return stream;
}

/** Appends one line to `<logsDir>/<name>.log`. Never throws. */
export function logLine(logsDir: string, name: string, line: string): void {
  try {
    mkdirSync(logsDir, { recursive: true });
    appendFileSync(join(logsDir, `${name}.log`), `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    // logging must never take the app down
  }
}

/** Copies a child's output into the log without closing the log when the child's stream ends. */
export function pipeToLog(source: Readable | null | undefined, log: WriteStream): void {
  source?.pipe(log, { end: false });
}

/** Keeps the last `max` characters written to a stream, for error messages. */
export function keepTail(source: Readable | null | undefined, max = 4_000): () => string {
  let tail = '';
  source?.on('data', (chunk: Buffer) => {
    tail = (tail + chunk.toString('utf8')).slice(-max);
  });
  return () => tail.trim();
}

/** Ends the log and resolves once everything is on disk. Safe to call more than once. */
export function closeLog(log: WriteStream): Promise<void> {
  if (log.writableFinished) return Promise.resolve();
  return new Promise((resolve) => {
    log.once('finish', resolve);
    log.once('close', resolve);
    if (!log.writableEnded) log.end();
  });
}

/** Ends the log once every given output stream has ended, so no trailing output is lost. */
export function closeLogAfter(log: WriteStream, sources: Array<Readable | null | undefined>): Promise<void> {
  const ended = sources
    .filter((s): s is Readable => Boolean(s))
    .map((s) => new Promise<void>((resolve) => {
      s.once('end', resolve);
      s.once('close', resolve);
      s.once('error', () => resolve());
    }));
  return Promise.all(ended).then(() => closeLog(log));
}
