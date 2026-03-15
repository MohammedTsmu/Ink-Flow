import { getStore } from './store';
import { runAutoMaintenancePrints } from './auto-print';
import { getMainWindow } from './main';
import { showAlertPopup } from './alert-window';

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

    let needsAttention = false;
    const alerts: Array<{ name: string; status: string; level: string; message: string }> = [];

    for (const printer of printers) {
      if (printer.status === 'overdue') {
        needsAttention = true;
        const daysOverdue = Math.abs(Math.round(printer.daysRemaining * 10) / 10);
        let level: string;
        let message: string;

        if (daysOverdue >= printer.maxIdleDays * 2) {
          level = 'critical';
          message = `${daysOverdue} days overdue! Nozzles are very likely clogged. Turn on the printer and run a deep clean cycle immediately.`;
        } else if (daysOverdue >= printer.maxIdleDays) {
          level = 'severe';
          message = `${daysOverdue} days overdue! High risk of permanent nozzle damage. Turn on and clean ASAP.`;
        } else {
          level = 'overdue';
          message = `${daysOverdue} day(s) overdue. Print or clean this printer soon to prevent clogging.`;
        }

        alerts.push({ name: printer.name, status: printer.status, level, message });
      } else if (printer.status === 'urgent') {
        needsAttention = true;
        alerts.push({
          name: printer.name,
          status: printer.status,
          level: 'urgent',
          message: 'Less than 1 day remaining before maintenance is needed!',
        });
      } else if (printer.status === 'warning') {
        needsAttention = true;
        alerts.push({
          name: printer.name,
          status: printer.status,
          level: 'warning',
          message: `${Math.round(printer.daysRemaining)} day(s) remaining before maintenance is needed.`,
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
    if (needsAttention) {
      grabAttention();
    }
  } catch {
    // Silently ignore — store may not be ready yet
  }

  // Run auto maintenance prints after checking statuses
  runAutoMaintenancePrints();
}

/** Flash the taskbar icon and show the window so the user notices alerts. */
function grabAttention(): void {
  const win = getMainWindow();
  if (!win) return;

  // Flash taskbar until the user focuses the window
  win.flashFrame(true);

  // If the window is hidden, show it
  if (!win.isVisible()) {
    win.show();
  }

  // If minimized, restore it
  if (win.isMinimized()) {
    win.restore();
  }

  // Stop flashing once the user focuses the window
  win.once('focus', () => {
    win.flashFrame(false);
  });
}
