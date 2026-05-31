import { PrinterRecord } from './types';

/**
 * Decides whether a printer's current alert is "fresh enough" to be
 * worth pushing to the user, given when (and at what level) we last
 * alerted about it.
 *
 * Rules:
 *   - Fire if we've never alerted about this printer.
 *   - Fire if the new level is more severe than the last one (escalation
 *     is always worth interrupting for).
 *   - Otherwise rate-limit by `cooldownMs` (default 24h) so a printer
 *     that stays "overdue" for two weeks doesn't trigger 336 popups.
 *
 * The CALLER is responsible for stamping lastAlertedAt + lastAlertedLevel
 * on the printer record when it decides to actually alert.
 */

const LEVEL_RANK: Record<string, number> = {
  warning: 1,
  urgent: 2,
  overdue: 3,
  severe: 4,
  critical: 5,
};

export const DEFAULT_ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;     // 24h
export const DEFAULT_NOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000;     // 6h for native toast

export function shouldAlert(
  printer: PrinterRecord,
  currentLevel: string,
  now: number = Date.now(),
  cooldownMs: number = DEFAULT_ALERT_COOLDOWN_MS,
): boolean {
  if (!printer.lastAlertedAt) return true;
  const prevRank = LEVEL_RANK[printer.lastAlertedLevel || ''] ?? 0;
  const currRank = LEVEL_RANK[currentLevel] ?? 0;
  if (currRank > prevRank) return true;            // escalation
  const ageMs = now - new Date(printer.lastAlertedAt).getTime();
  return ageMs >= cooldownMs;
}

export function shouldFireAutoPrintNotification(
  printer: PrinterRecord,
  now: number = Date.now(),
  cooldownMs: number = DEFAULT_NOTIFY_COOLDOWN_MS,
): boolean {
  if (!printer.lastAutoPrintNotifiedAt) return true;
  const ageMs = now - new Date(printer.lastAutoPrintNotifiedAt).getTime();
  return ageMs >= cooldownMs;
}
