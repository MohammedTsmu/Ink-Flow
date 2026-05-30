import { EventRecord, PrinterStatus } from './types';

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
