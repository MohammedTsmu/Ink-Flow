import { describe, it, expect } from 'vitest';
import { buildTickStats } from '../tick-stats';
import { LogEntry } from '../log';

function entry(source: string, message: string, level: LogEntry['level'] = 'info', detail?: unknown): LogEntry {
  return { ts: '2025-01-15T00:00:00Z', source, message, level, detail };
}

describe('buildTickStats', () => {
  it('aggregates tick activity across many entries', () => {
    const entries: LogEntry[] = [
      entry('tick', 'Tick run started'),
      entry('tick', 'Sent maintenance print', 'info', { printer: 'HP' }),
      entry('tick', 'Sent maintenance print', 'info', { printer: 'Brother' }),
      entry('tick', 'Skipped: printer offline', 'warn'),
      entry('tick', 'Tick run started'),
      entry('tick', 'Sent maintenance print', 'info', { printer: 'HP' }),  // duplicate
      entry('auto-print', 'Maintenance print failed', 'error'),
    ];
    const s = buildTickStats(entries);
    expect(s.ticksRan).toBe(2);
    expect(s.prints).toBe(3);
    expect(s.offlineSkips).toBe(1);
    expect(s.failures).toBe(1);
    expect(s.uniquePrintersServed).toBe(2);
  });

  it('returns zeroes for an empty log', () => {
    const s = buildTickStats([]);
    expect(s).toEqual({ ticksRan: 0, prints: 0, offlineSkips: 0, failures: 0, uniquePrintersServed: 0 });
  });

  it('ignores entries from non-tick sources', () => {
    const entries: LogEntry[] = [
      entry('store', 'Refreshed from disk'),
      entry('print-monitor', 'Auto-logged print job'),
      entry('app', 'Starting Ink Flow'),
    ];
    const s = buildTickStats(entries);
    expect(s.ticksRan).toBe(0);
    expect(s.prints).toBe(0);
  });
});
