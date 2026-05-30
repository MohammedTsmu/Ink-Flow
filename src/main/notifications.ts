import { app } from 'electron';
import { getStore } from './store';
import { runAutoMaintenancePrints } from './auto-print';
import { getMainWindow } from './main';
import { showAlertPopup } from './alert-window';
import { computeAlert } from '../core/severity';
import { error } from '../core/log';

let intervalId: ReturnType<typeof setInterval> | null = null;
let initialTimeout: ReturnType<typeof setTimeout> | null = null;

export function startNotificationScheduler(): void {
  // Check once on startup (delayed 10s to let the app settle)
  initialTimeout = setTimeout(() => { checkStatuses(); initialTimeout = null; }, 10_000);
  // Then check every hour
  intervalId = setInterval(checkStatuses, 60 * 60 * 1000);
}

/** Manually trigger a notification check (for testing). */
export function runNotificationCheck(): void {
  checkStatuses();
}

export function stopNotificationScheduler(): void {
  if (initialTimeout) {
    clearTimeout(initialTimeout);
    initialTimeout = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function checkStatuses(): void {
  try {
    const store = getStore();
    const printers = store.getPrintersWithStatus();

    const alerts: Array<{ name: string; status: string; level: string; message: string }> = [];

    for (const printer of printers) {
      const alert = computeAlert(printer.status, printer.daysRemaining, printer.maxIdleDays);
      if (alert) {
        alerts.push({
          name: printer.name,
          status: printer.status,
          level: alert.level,
          message: alert.message,
        });
      }
    }

    // Show the standalone popup alert (appears on top of everything, even without the main window)
    if (alerts.length > 0) {
      showAlertPopup(alerts);
    }

    // Also send alerts to the renderer in-app modal (if main window is visible)
    if (alerts.length > 0) {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('printer-alerts', alerts);
      }
    }

    // Flash taskbar and bring window forward so user notices
    if (alerts.length > 0) {
      grabAttention();
    }
  } catch (err) {
    error('notifications', 'checkStatuses failed', err);
  }

  // Run auto maintenance prints after checking statuses
  runAutoMaintenancePrints();
}

/**
 * Grab the user's attention in a platform-appropriate way.
 *   Windows / Linux : flashFrame  + restore-if-minimised
 *   macOS           : app.dock.bounce('critical')  — flashFrame is no-op
 * The window itself is NOT auto-shown on macOS because dock-bouncing is
 * the established convention there; abruptly stealing the Space would
 * be jarring.
 */
function grabAttention(): void {
  const win = getMainWindow();
  if (!win) return;

  if (process.platform === 'darwin') {
    try { app.dock?.bounce('critical'); } catch { /* dock may not exist (headless test) */ }
    return;
  }

  win.flashFrame(true);
  if (!win.isVisible()) win.show();
  if (win.isMinimized()) win.restore();
  win.once('focus', () => { win.flashFrame(false); });
}
