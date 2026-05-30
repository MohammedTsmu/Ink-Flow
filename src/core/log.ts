import fs from 'fs';
import path from 'path';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  source: string;
  message: string;
  detail?: unknown;
}

/**
 * Structured JSONL logger shared by the Electron main process and the
 * headless maintenance tick. Replaces the silent `catch {}` blocks
 * scattered across the codebase so failures surface in the
 * Diagnostics panel and on disk.
 *
 *   {"ts":"...","level":"error","source":"print-monitor","message":"...","detail":{...}}
 *
 * Rotates at 1 MB to keep the file bounded.
 */

const MAX_BYTES = 1024 * 1024;

let logPath: string | null = null;

export function initLogger(dirPath: string): void {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {
    // If we can't create the directory we'll still try to write below.
  }
  logPath = path.join(dirPath, 'diagnostics.log');
}

export function getLogPath(): string | null {
  return logPath;
}

export function log(level: LogLevel, source: string, message: string, detail?: unknown): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    source,
    message,
  };
  if (detail !== undefined) entry.detail = serializeDetail(detail);

  const line = JSON.stringify(entry) + '\n';

  if (!logPath) {
    // Not initialised yet — fall back to stderr so the event isn't lost
    try { process.stderr.write('[inkflow] ' + line); } catch { /* nothing else to do */ }
    return;
  }

  try {
    rotateIfNeeded();
    fs.appendFileSync(logPath, line, 'utf-8');
  } catch (err) {
    try {
      process.stderr.write('[inkflow-log-fail] ' + line);
      process.stderr.write('[inkflow-log-fail] writer error: ' + String(err) + '\n');
    } catch { /* give up quietly */ }
  }
}

export function info(source: string, message: string, detail?: unknown): void {
  log('info', source, message, detail);
}

export function warn(source: string, message: string, detail?: unknown): void {
  log('warn', source, message, detail);
}

export function error(source: string, message: string, detail?: unknown): void {
  log('error', source, message, detail);
}

/** Read the most recent entries, newest first. */
export function readRecentEntries(limit = 100): LogEntry[] {
  if (!logPath) return [];
  try {
    const raw = fs.readFileSync(logPath, 'utf-8');
    const lines = raw.split('\n').filter(l => l.trim().length > 0);
    const tail = lines.slice(-limit).reverse();
    const entries: LogEntry[] = [];
    for (const l of tail) {
      try {
        entries.push(JSON.parse(l) as LogEntry);
      } catch { /* skip malformed line */ }
    }
    return entries;
  } catch {
    return [];
  }
}

function rotateIfNeeded(): void {
  if (!logPath) return;
  try {
    const stat = fs.statSync(logPath);
    if (stat.size < MAX_BYTES) return;
    const archived = logPath + '.1';
    try { fs.unlinkSync(archived); } catch { /* may not exist */ }
    fs.renameSync(logPath, archived);
  } catch {
    // File may not exist yet, or rename may fail (e.g. AV holding handle).
    // Worst case: file keeps growing past MAX_BYTES until the next rotation succeeds.
  }
}

function serializeDetail(detail: unknown): unknown {
  if (detail instanceof Error) {
    return { name: detail.name, message: detail.message, stack: detail.stack };
  }
  if (typeof detail === 'object' && detail !== null) {
    try {
      // Round-trip through JSON to strip non-serialisable values.
      return JSON.parse(JSON.stringify(detail));
    } catch {
      return String(detail);
    }
  }
  return detail;
}

/** Test/internal helper: reset the logger state. */
export function _resetForTests(): void {
  logPath = null;
}
