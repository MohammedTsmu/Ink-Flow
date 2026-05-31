import { describe, it, expect } from 'vitest';
import { buildTickSummary, summaryWorthShowing } from '../tick-summary';
import { LogEntry } from '../log';

const since = '2025-01-15T00:00:00.000Z';

function entry(ts: string, source: string, message: string, level: LogEntry['level'] = 'info', detail?: unknown): LogEntry {
  return { ts, source, message, level, detail };
}

describe('buildTickSummary', () => {
  it('counts tick runs and prints in the time window', () => {
    const entries: LogEntry[] = [
      entry('2025-01-15T06:00:00Z', 'tick', 'Tick run started'),
      entry('2025-01-15T06:00:01Z', 'tick', 'Sent maintenance print', 'info', { printer: 'HP' }),
      entry('2025-01-15T12:00:00Z', 'tick', 'Tick run started'),
      entry('2025-01-15T12:00:01Z', 'tick', 'Sent maintenance print', 'info', { printer: 'Brother' }),
    ];
    const s = buildTickSummary(entries, since);
    expect(s.ticksRan).toBe(2);
    expect(s.prints).toBe(2);
    expect(s.printersServed.sort()).toEqual(['Brother', 'HP']);
  });

  it('excludes entries before since', () => {
    const entries: LogEntry[] = [
      entry('2025-01-14T22:00:00Z', 'tick', 'Tick run started'),  // before
      entry('2025-01-15T06:00:00Z', 'tick', 'Tick run started'),  // after
    ];
    const s = buildTickSummary(entries, since);
    expect(s.ticksRan).toBe(1);
  });

  it('counts skipped-offline events', () => {
    const entries: LogEntry[] = [
      entry('2025-01-15T06:00:00Z', 'tick', 'Skipped: printer offline', 'warn'),
      entry('2025-01-15T12:00:00Z', 'tick', 'Skipped: printer offline', 'warn'),
    ];
    const s = buildTickSummary(entries, since);
    expect(s.offlineSkips).toBe(2);
  });

  it('counts error-level entries as failures', () => {
    const entries: LogEntry[] = [
      entry('2025-01-15T06:00:00Z', 'tick', 'Maintenance print failed', 'error'),
    ];
    const s = buildTickSummary(entries, since);
    expect(s.failures).toBe(1);
  });

  it('dedupes printersServed', () => {
    const entries: LogEntry[] = [
      entry('2025-01-15T06:00:00Z', 'tick', 'Sent maintenance print', 'info', { printer: 'HP' }),
      entry('2025-01-15T12:00:00Z', 'tick', 'Sent maintenance print', 'info', { printer: 'HP' }),
    ];
    const s = buildTickSummary(entries, since);
    expect(s.printersServed).toEqual(['HP']);
    expect(s.prints).toBe(2);
  });

  it('ignores entries from other sources', () => {
    const entries: LogEntry[] = [
      entry('2025-01-15T06:00:00Z', 'store', 'Refreshed from disk'),
      entry('2025-01-15T07:00:00Z', 'print-monitor', 'Auto-logged print job'),
    ];
    const s = buildTickSummary(entries, since);
    expect(s.ticksRan).toBe(0);
    expect(s.prints).toBe(0);
  });
});

describe('summaryWorthShowing', () => {
  it('shows when there are tick runs', () => {
    expect(summaryWorthShowing({ since, ticksRan: 1, prints: 0, offlineSkips: 0, failures: 0, printersServed: [] })).toBe(true);
  });

  it('shows when there are failures even with no ticks', () => {
    expect(summaryWorthShowing({ since, ticksRan: 0, prints: 0, offlineSkips: 0, failures: 1, printersServed: [] })).toBe(true);
  });

  it('hides for an empty summary', () => {
    expect(summaryWorthShowing({ since, ticksRan: 0, prints: 0, offlineSkips: 0, failures: 0, printersServed: [] })).toBe(false);
  });
});
