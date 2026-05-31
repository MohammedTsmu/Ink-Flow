import { describe, it, expect } from 'vitest';
import { generateColorTestPng } from '../color-test-image';

describe('generateColorTestPng', () => {
  it('returns a non-empty buffer', () => {
    const buf = generateColorTestPng();
    expect(buf.length).toBeGreaterThan(1000);
  });

  it('starts with the PNG magic signature', () => {
    const buf = generateColorTestPng();
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(buf.slice(0, 8).equals(sig)).toBe(true);
  });

  it('declares 600×800 dimensions in IHDR', () => {
    const buf = generateColorTestPng();
    // IHDR chunk starts at byte 8 (after signature) + 4 (length) + 4 (type) = 16
    // Width is the next 4 bytes (big-endian)
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(width).toBe(600);
    expect(height).toBe(800);
  });
});
