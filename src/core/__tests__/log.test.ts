import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { initLogger, log, info, warn, error, readRecentEntries, _resetForTests } from '../log';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkflow-log-test-'));
  initLogger(tmpDir);
});

afterEach(() => {
  _resetForTests();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('log', () => {
  it('writes a single JSONL line per call', () => {
    info('test', 'hello');
    info('test', 'world');
    const lines = fs.readFileSync(path.join(tmpDir, 'diagnostics.log'), 'utf-8')
      .split('\n').filter(l => l);
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]);
    expect(first.level).toBe('info');
    expect(first.source).toBe('test');
    expect(first.message).toBe('hello');
    expect(first.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('serialises Error detail with name, message, stack', () => {
    error('test', 'boom', new Error('explosion'));
    const lines = fs.readFileSync(path.join(tmpDir, 'diagnostics.log'), 'utf-8')
      .split('\n').filter(l => l);
    const entry = JSON.parse(lines[0]);
    expect(entry.detail.name).toBe('Error');
    expect(entry.detail.message).toBe('explosion');
    expect(typeof entry.detail.stack).toBe('string');
  });

  it('readRecentEntries returns newest first', () => {
    info('test', 'first');
    info('test', 'second');
    info('test', 'third');
    const entries = readRecentEntries(10);
    expect(entries).toHaveLength(3);
    expect(entries[0].message).toBe('third');
    expect(entries[2].message).toBe('first');
  });

  it('readRecentEntries respects the limit', () => {
    for (let i = 0; i < 20; i++) info('test', `msg-${i}`);
    const entries = readRecentEntries(5);
    expect(entries).toHaveLength(5);
    expect(entries[0].message).toBe('msg-19');
  });

  it('does not throw if logger is not initialised', () => {
    _resetForTests();
    expect(() => log('warn', 'test', 'no init')).not.toThrow();
  });

  it('warn and error wrappers tag the correct level', () => {
    warn('test', 'a warning');
    error('test', 'an error');
    const entries = readRecentEntries(10);
    expect(entries.find(e => e.message === 'a warning')?.level).toBe('warn');
    expect(entries.find(e => e.message === 'an error')?.level).toBe('error');
  });
});
