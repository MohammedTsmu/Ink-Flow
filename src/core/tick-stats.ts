import { LogEntry } from './log';

export interface TickStats {
  /** Total tick runs observed in the supplied entries. */
  ticksRan: number;
  /** Maintenance prints actually sent by the tick or hourly auto-print. */
  prints: number;
  /** Times a printer was skipped because it was offline. */
  offlineSkips: number;
  /** Error-level entries from tick / auto-print. */
  failures: number;
  /** Distinct printer names that received an auto-print. */
  uniquePrintersServed: number;
}

/**
 * Aggregates everything the headless tick (and on-window auto-print)
 * has done across all retained diagnostics. Used by the Statistics
 * panel so the user can verify the background is doing useful work.
 */
export function buildTickStats(entries: LogEntry[]): TickStats {
  const printers = new Set<string>();
  let ticksRan = 0;
  let prints = 0;
  let offlineSkips = 0;
  let failures = 0;

  for (const e of entries) {
    if (e.source !== 'tick' && e.source !== 'auto-print') continue;
    if (e.message === 'Tick run started') ticksRan++;
    if (e.message === 'Sent maintenance print') {
      prints++;
      const printerName = (e.detail as { printer?: string } | undefined)?.printer;
      if (printerName) printers.add(printerName);
    }
    if (e.message === 'Skipped: printer offline') offlineSkips++;
    if (e.level === 'error') failures++;
  }

  return { ticksRan, prints, offlineSkips, failures, uniquePrintersServed: printers.size };
}
