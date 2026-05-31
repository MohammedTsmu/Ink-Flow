import { LogEntry } from './log';
import { TickSummary } from './types';

/**
 * Walk a sorted-newest-first list of log entries and roll up the
 * activity from the headless tick since `since` (ISO). Used by the
 * GUI on launch to surface "what did the tick do while I was away?"
 */
export function buildTickSummary(entries: LogEntry[], since: string): TickSummary {
  const sinceMs = new Date(since).getTime();
  const printersServed = new Set<string>();
  let ticksRan = 0;
  let prints = 0;
  let offlineSkips = 0;
  let failures = 0;

  for (const e of entries) {
    if (e.source !== 'tick' && e.source !== 'auto-print') continue;
    const t = new Date(e.ts).getTime();
    if (Number.isFinite(sinceMs) && t < sinceMs) continue;

    if (e.message === 'Tick run started') ticksRan++;
    if (e.message === 'Sent maintenance print') {
      prints++;
      const printerName = (e.detail as { printer?: string } | undefined)?.printer;
      if (printerName) printersServed.add(printerName);
    }
    if (e.message === 'Skipped: printer offline') offlineSkips++;
    if (e.level === 'error') failures++;
  }

  return {
    since,
    ticksRan,
    prints,
    offlineSkips,
    failures,
    printersServed: [...printersServed],
  };
}

/** True when there's anything worth surfacing to the user. */
export function summaryWorthShowing(s: TickSummary): boolean {
  return s.ticksRan > 0 || s.prints > 0 || s.failures > 0;
}
