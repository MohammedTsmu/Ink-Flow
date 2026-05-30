import { PrinterStatus } from './types';

export type AlertLevel = 'warning' | 'urgent' | 'overdue' | 'severe' | 'critical';

export interface AlertInfo {
  level: AlertLevel;
  message: string;
}

/**
 * Map a printer's current status + how-overdue into an alert level and
 * user-facing message. Returns null when the printer is healthy.
 *
 *   - status 'overdue', daysOverdue ≥ 2×maxIdleDays → critical
 *   - status 'overdue', daysOverdue ≥   maxIdleDays → severe
 *   - status 'overdue', otherwise                    → overdue
 *   - status 'urgent'                                → urgent
 *   - status 'warning'                               → warning
 *   - status 'good'                                  → null
 */
export function computeAlert(
  status: PrinterStatus,
  daysRemaining: number,
  maxIdleDays: number,
): AlertInfo | null {
  if (status === 'overdue') {
    const daysOverdue = Math.abs(Math.round(daysRemaining * 10) / 10);
    if (daysOverdue >= maxIdleDays * 2) {
      return {
        level: 'critical',
        message: `${daysOverdue} days overdue! Nozzles are very likely clogged. Turn on the printer and run a deep clean cycle immediately.`,
      };
    }
    if (daysOverdue >= maxIdleDays) {
      return {
        level: 'severe',
        message: `${daysOverdue} days overdue! High risk of permanent nozzle damage. Turn on and clean ASAP.`,
      };
    }
    return {
      level: 'overdue',
      message: `${daysOverdue} day(s) overdue. Print or clean this printer soon to prevent clogging.`,
    };
  }

  if (status === 'urgent') {
    return {
      level: 'urgent',
      message: 'Less than 1 day remaining before maintenance is needed!',
    };
  }

  if (status === 'warning') {
    return {
      level: 'warning',
      message: `${Math.round(daysRemaining)} day(s) remaining before maintenance is needed.`,
    };
  }

  return null;
}
