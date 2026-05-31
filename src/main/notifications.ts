import { app } from 'electron';
import { getStore } from './store';
import { runAutoMaintenancePrints } from './auto-print';
import { getMainWindow } from './main';
import { showAlertPopup } from './alert-window';
import { computeAlert } from '../core/severity';
import { error, info } from '../core/log';
import { shouldAlert } from '../core/alert-throttle';

let intervalId: ReturnType<typeof setInterval> | null = null;
let initialTimeout: ReturnType<typeof setTimeout> | null = null;

export function startNotificationScheduler(): void {
  initialTimeout = setTimeout(() => { checkStatuses(); initialTimeout = null; }, 10_000);
  intervalId = setInterval(checkStatuses, 60 * 60 * 1000);
}

export function runNotificationCheck(): void {
  checkStatuses();
}

export function stopNotificationScheduler(): void {
  if (initialTimeout) { clearTimeout(initialTimeout); initialTimeout = null; }
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

interface AlertOut {
  printerId: number;
  name: string;
  status: string;
  level: string;
  message: string;
  /** True when this alert is new or escalated (caller should interrupt the user). */
  isNew: boolean;
}

function checkStatuses(): void {
  try {
    const store = getStore();
    const printers = store.getPrintersWithStatus();
    const alerts: AlertOut[] = [];

    for (const printer of printers) {
      const alert = computeAlert(printer.status, printer.daysRemaining, printer.maxIdleDays);
      if (!alert) {
        // Printer went back to 'good' — drop any old alert history so a future
        // re-overdue treats it as a fresh escalation.
        if (printer.lastAlertedAt) store.clearAlertHistory(printer.id);
        continue;
      }
      const shouldShow = shouldAlert(printer, alert.level);
      if (!shouldShow) continue;

      const isEscalation = !printer.lastAlertedAt || printer.lastAlertedLevel !== alert.level;
      alerts.push({
        printerId: printer.id,
        name: printer.name,
        status: printer.status,
        level: alert.level,
        message: alert.message,
        isNew: isEscalation,
      });
      store.markAlertSent(printer.id, alert.level);
    }

    if (alerts.length > 0) {
      info('notifications', 'Surfacing alerts', { count: alerts.length, levels: alerts.map(a => a.level) });

      // Single consolidated popup; the popup already renders multiple cards.
      showAlertPopup(alerts.map(a => ({ name: a.name, status: a.status, level: a.level, message: a.message })));

      // In-app modal
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('printer-alerts', alerts.map(a => ({ name: a.name, status: a.status, level: a.level, message: a.message })));
      }

      // Only steal focus / bounce dock when there's a NEW or ESCALATED alert.
      // Stable "still overdue" alerts every 24h shouldn't keep stealing focus.
      if (alerts.some(a => a.isNew)) {
        grabAttention();
      }
    } else {
      info('notifications', 'Check ran — no fresh alerts to surface');
    }
  } catch (err) {
    error('notifications', 'checkStatuses failed', err);
  }

  runAutoMaintenancePrints();
}

function grabAttention(): void {
  const win = getMainWindow();
  if (!win) return;

  if (process.platform === 'darwin') {
    try { app.dock?.bounce('informational'); } catch { /* no dock in test env */ }
    return;
  }

  win.flashFrame(true);
  if (!win.isVisible()) win.show();
  if (win.isMinimized()) win.restore();
  win.once('focus', () => { win.flashFrame(false); });
}
