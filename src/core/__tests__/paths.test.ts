import { describe, it, expect } from 'vitest';
import os from 'os';
import path from 'path';
import { getUserDataPath, resolveUserDataFromArgv, APP_DIR_NAME } from '../paths';

describe('getUserDataPath', () => {
  it('returns a non-empty absolute path containing the app name', () => {
    const p = getUserDataPath();
    expect(p.length).toBeGreaterThan(0);
    expect(path.isAbsolute(p)).toBe(true);
    expect(p).toContain(APP_DIR_NAME);
  });

  it('accepts a custom app name', () => {
    const p = getUserDataPath('alt-name');
    expect(p).toContain('alt-name');
    expect(p).not.toContain(APP_DIR_NAME);
  });
});

describe('resolveUserDataFromArgv', () => {
  it('honours --user-data= argument', () => {
    const explicit = process.platform === 'win32' ? 'C:\\foo\\bar' : '/foo/bar';
    const result = resolveUserDataFromArgv(['node', 'tick.js', `--user-data=${explicit}`]);
    expect(result).toBe(explicit);
  });

  it('falls back to platform default when no flag passed', () => {
    const result = resolveUserDataFromArgv(['node', 'tick.js']);
    expect(result).toBe(getUserDataPath());
  });

  it('ignores empty --user-data= and falls back to default', () => {
    const result = resolveUserDataFromArgv(['node', 'tick.js', '--user-data=']);
    expect(result).toBe(getUserDataPath());
  });

  it('supports paths containing equals signs', () => {
    const weird = path.join(os.tmpdir(), 'a=b', 'c');
    const result = resolveUserDataFromArgv(['node', 'tick.js', `--user-data=${weird}`]);
    expect(result).toBe(weird);
  });
});
