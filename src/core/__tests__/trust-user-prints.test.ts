import { describe, it, expect } from 'vitest';
import { pickStatusEvent, inferCategory } from '../status';
import { EventRecord } from '../types';

const ONE_DAY_MS = 86_400_000;
const NOW = new Date('2025-01-15T12:00:00Z').getTime();

function ev(daysAgo: number, type: 'print' | 'clean', notes: string, category?: EventRecord['category']): EventRecord {
  return {
    id: Math.random(),
    printerId: 1,
    eventType: type,
    eventDate: new Date(NOW - daysAgo * ONE_DAY_MS).toISOString(),
    notes,
    ...(category ? { category } : {}),
  };
}

describe('pickStatusEvent — trustUserPrints=true (legacy/default)', () => {
  it('returns the most recent event regardless of category', () => {
    const events = [
      ev(5, 'print', 'Auto-detected print job: invoice.pdf', 'user'),
      ev(10, 'print', 'Auto maintenance print', 'maintenance'),
    ];
    expect(pickStatusEvent(events, true)?.notes).toMatch(/Auto-detected/);
  });

  it('returns null on empty input', () => {
    expect(pickStatusEvent([], true)).toBeNull();
  });
});

describe('pickStatusEvent — trustUserPrints=false (conservative)', () => {
  it('skips user-print events and picks the most recent maintenance', () => {
    const events = [
      ev(1, 'print', 'Auto-detected print job: doc.pdf', 'user'),
      ev(2, 'print', 'Auto-detected print job: other.pdf', 'user'),
      ev(10, 'print', 'Auto maintenance print', 'maintenance'),
    ];
    const picked = pickStatusEvent(events, false);
    expect(picked?.notes).toBe('Auto maintenance print');
  });

  it('picks clean events too', () => {
    const events = [
      ev(1, 'print', 'Auto-detected', 'user'),
      ev(3, 'clean', '', 'clean'),
    ];
    expect(pickStatusEvent(events, false)?.eventType).toBe('clean');
  });

  it('returns null when only user events exist', () => {
    const events = [
      ev(1, 'print', 'Auto-detected', 'user'),
      ev(2, 'print', 'Auto-detected', 'user'),
    ];
    expect(pickStatusEvent(events, false)).toBeNull();
  });

  it('classifies legacy events without category by notes', () => {
    const events = [
      ev(1, 'print', 'Auto-detected print job'),         // user (legacy)
      ev(5, 'print', 'Initial setup – timer started'),    // maintenance (legacy)
    ];
    const picked = pickStatusEvent(events, false);
    expect(picked?.notes).toMatch(/Initial setup/);
  });
});

describe('inferCategory', () => {
  it.each([
    ['clean', 'something', 'clean'],
    ['print', 'Auto maintenance print', 'maintenance'],
    ['print', 'Initial setup – timer started', 'maintenance'],
    ['print', 'Manual test print', 'maintenance'],
    ['print', 'Headless maintenance tick', 'maintenance'],
    ['print', 'Auto-detected print job: invoice.pdf', 'user'],
    ['print', '', 'user'],
  ] as const)('eventType=%s notes=%s → %s', (eventType, notes, expected) => {
    expect(inferCategory({ id: 1, printerId: 1, eventType, eventDate: '', notes })).toBe(expected);
  });
});
