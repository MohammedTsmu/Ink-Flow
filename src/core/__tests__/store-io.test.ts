import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  readStoreFile,
  writeStoreFileAtomic,
  withStoreLock,
  mtimeOf,
  emptyStore,
} from '../store-io';

let tmpDir: string;
let storePath: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkflow-storeio-'));
  storePath = path.join(tmpDir, 'inkflow-data.json');
});

afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('readStoreFile', () => {
  it('returns null when file missing', () => {
    expect(readStoreFile(storePath)).toBeNull();
  });

  it('returns null when file is corrupt JSON', () => {
    fs.writeFileSync(storePath, '{not valid json');
    expect(readStoreFile(storePath)).toBeNull();
  });

  it('returns null when printers/events are not arrays', () => {
    fs.writeFileSync(storePath, JSON.stringify({ printers: 'oops', events: [] }));
    expect(readStoreFile(storePath)).toBeNull();
  });

  it('round-trips an empty store', () => {
    writeStoreFileAtomic(storePath, emptyStore());
    const data = readStoreFile(storePath);
    expect(data).not.toBeNull();
    expect(data?.printers).toEqual([]);
    expect(data?.nextPrinterId).toBe(1);
  });
});

describe('writeStoreFileAtomic', () => {
  it('creates the parent directory if missing', () => {
    const nested = path.join(tmpDir, 'sub', 'a.json');
    writeStoreFileAtomic(nested, emptyStore());
    expect(fs.existsSync(nested)).toBe(true);
  });

  it('does not leave a .tmp file behind on success', () => {
    writeStoreFileAtomic(storePath, emptyStore());
    expect(fs.existsSync(storePath + '.tmp')).toBe(false);
  });
});

describe('withStoreLock', () => {
  it('runs the callback under the lock', async () => {
    const result = await withStoreLock(storePath, () => 42);
    expect(result).toBe(42);
  });

  it('serialises concurrent callers', async () => {
    writeStoreFileAtomic(storePath, emptyStore());
    const events: string[] = [];

    const a = withStoreLock(storePath, async () => {
      events.push('a:start');
      await new Promise(r => setTimeout(r, 100));
      events.push('a:end');
    });
    const b = withStoreLock(storePath, () => {
      events.push('b:start');
      events.push('b:end');
    });

    await Promise.all([a, b]);

    // a started first and must finish before b starts (lock is exclusive)
    const aStart = events.indexOf('a:start');
    const aEnd = events.indexOf('a:end');
    const bStart = events.indexOf('b:start');
    expect(aStart).toBeLessThan(aEnd);
    expect(aEnd).toBeLessThan(bStart);
  });

  it('releases the lock even when the callback throws', async () => {
    writeStoreFileAtomic(storePath, emptyStore());
    await expect(withStoreLock(storePath, () => { throw new Error('boom'); }))
      .rejects.toThrow('boom');
    // second acquisition must succeed
    const v = await withStoreLock(storePath, () => 'ok');
    expect(v).toBe('ok');
  });
});

describe('mtimeOf', () => {
  it('returns 0 for a missing file', () => {
    expect(mtimeOf(storePath)).toBe(0);
  });

  it('returns a number greater than 0 for an existing file', () => {
    writeStoreFileAtomic(storePath, emptyStore());
    expect(mtimeOf(storePath)).toBeGreaterThan(0);
  });
});
