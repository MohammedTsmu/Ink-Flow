import { EventRecord, PrinterStatus, EventCategory } from './types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface StatusResult {
  daysRemaining: number;
  status: PrinterStatus;
}

/**
 * Pure calculation of a printer's maintenance status from its last event
 * and idle thresholds. `now` is parameterised for testability.
 *
 *   - no last event           → overdue (0 days remaining)
 *   - remaining ≤ 0           → overdue
 *   - remaining ≤ 1 day       → urgent
 *   - remaining ≤ warningDays → warning
 *   - otherwise               → good
 */
export function calculateStatus(
  lastEvent: EventRecord | null,
  maxIdleDays: number,
  warningDays: number,
  now: number = Date.now(),
): StatusResult {
  if (!lastEvent) {
    return { daysRemaining: 0, status: 'overdue' };
  }

  const diffMs = now - new Date(lastEvent.eventDate).getTime();
  const diffDays = diffMs / MS_PER_DAY;
  const remaining = Math.round((maxIdleDays - diffDays) * 10) / 10;

  let status: PrinterStatus;
  if (remaining <= 0) status = 'overdue';
  else if (remaining <= 1) status = 'urgent';
  else if (remaining <= warningDays) status = 'warning';
  else status = 'good';

  return { daysRemaining: remaining, status };
}

/**
 * Pick the most recent event from a list that counts as "exercised the
 * print head". When trustUserPrints is true (or undefined for legacy
 * data), every event counts. When false, only color-test prints and
 * cleans count — external prints become informational and don't reset
 * the maintenance timer, because we can't know which channels fired.
 */
export function pickStatusEvent(
  events: EventRecord[],
  trustUserPrints: boolean = true,
): EventRecord | null {
  if (events.length === 0) return null;
  const sorted = [...events].sort((a, b) =>
    new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
  );
  if (trustUserPrints) return sorted[0] ?? null;

  const allowed: EventCategory[] = ['maintenance', 'clean'];
  for (const e of sorted) {
    if (e.category && allowed.includes(e.category)) return e;
    // Legacy events (no category) — classify on the fly by notes/type.
    if (!e.category) {
      const cat = inferCategory(e);
      if (allowed.includes(cat)) return e;
    }
  }
  return null;
}

/** Infer the category of an old (uncategorised) event from its eventType+notes. */
export function inferCategory(event: EventRecord): EventCategory {
  if (event.eventType === 'clean') return 'clean';
  const n = (event.notes || '').toLowerCase();
  if (n.includes('maintenance') || n.includes('initial setup') || n.includes('test print')) {
    return 'maintenance';
  }
  return 'user';
}
