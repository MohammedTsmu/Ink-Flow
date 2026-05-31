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

  it('serialises concurrent callers (no interleave, either order)', async () => {
    writeStoreFileAtomic(storePath, emptyStore());
    const events: string[] = [];

    const op = (name: string) => async () => {
      events.push(`${name}:start`);
      await new Promise(r => setTimeout(r, 50));
      events.push(`${name}:end`);
    };

    // Both calls start before either acquires the lock. proper-lockfile
    // does not guarantee FIFO across pending acquisitions — on macOS we've
    // observed the second caller getting the lock first. So we don't
    // assert an order; we only assert *exclusivity* (no interleaving).
    const a = withStoreLock(storePath, op('a'));
    const b = withStoreLock(storePath, op('b'));
    await Promise.all([a, b]);

    expect(events).toHaveLength(4);
    const seq = events.join(' ');
    const validOrders = new Set([
      'a:start a:end b:start b:end',
      'b:start b:end a:start a:end',
    ]);
    expect(validOrders.has(seq)).toBe(true);
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
