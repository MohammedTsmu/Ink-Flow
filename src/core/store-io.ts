import fs from 'fs';
import path from 'path';
import lockfile from 'proper-lockfile';
import { StoreData } from './types';

/**
 * Shared store I/O helpers used by both the Electron main process
 * (synchronously inside the Store class) and the headless tick
 * (asynchronously, with cross-process locking).
 *
 *  - readStoreFile           atomic read, returns null on missing/corrupt
 *  - writeStoreFileAtomic    temp + rename, no lock acquired
 *  - withStoreLock           async cross-process exclusive lock,
 *                            uses <file>.lock with stale-detection
 *  - mtimeOf                 fast freshness probe for refresh-if-stale
 */

const DEFAULT_LOCK_OPTIONS: lockfile.LockOptions = {
  stale: 10_000,
  retries: { retries: 5, minTimeout: 50, maxTimeout: 500 },
};

export function readStoreFile(filePath: string): StoreData | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as StoreData;
    if (!Array.isArray(parsed.printers) || !Array.isArray(parsed.events)) return null;
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return null;
  }
}

export function writeStoreFileAtomic(filePath: string, data: StoreData): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}

/**
 * Acquire a cross-process exclusive lock on the store file while `fn`
 * runs. Used by the tick (and any future external mutator) to safely
 * read-modify-write without racing the GUI. The lock file is
 * `<filePath>.lock`. Stale locks older than 10 s are reclaimed.
 */
export async function withStoreLock<T>(
  filePath: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  // proper-lockfile requires the target file to exist before locking.
  if (!fs.existsSync(filePath)) {
    writeStoreFileAtomic(filePath, emptyStore());
  }
  const release = await lockfile.lock(filePath, DEFAULT_LOCK_OPTIONS);
  try {
    return await fn();
  } finally {
    await release();
  }
}

export function mtimeOf(filePath: string): number {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

export function emptyStore(): StoreData {
  return {
    printers: [],
    events: [],
    nextPrinterId: 1,
    nextEventId: 1,
    settings: {
      autoMaintenancePrint: false,
      theme: 'dark',
      maintenanceWindow: { startHour: 0, endHour: 24 },
      tickIntervalSeconds: 6 * 60 * 60,
    },
    lastPrintCheckTime: new Date().toISOString(),
  };
}
