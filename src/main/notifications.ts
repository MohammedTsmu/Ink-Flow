import { Notification } from 'electron';
import { getStore } from './store';
import { runAutoMaintenancePrints } from './auto-print';

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startNotificationScheduler(): void {
  // Check once on startup (delayed 10s to let the app settle)
  setTimeout(checkStatuses, 10_000);
  // Then check every hour
  intervalId = setInterval(checkStatuses, 60 * 60 * 1000);
}

export function stopNotificationScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function checkStatuses(): void {
  try {
    const store = getStore();
    const printers = store.getPrintersWithStatus();

    for (const printer of printers) {
      if (printer.status === 'overdue') {
        notify(
          `⚠ ${printer.name} — OVERDUE`,
          'Maintenance overdue! Print or clean this printer immediately to prevent nozzle clogging.',
          'critical',
        );
      } else if (printer.status === 'urgent') {
        notify(
          `🔴 ${printer.name} — Urgent`,
          'Less than 1 day remaining before maintenance is needed!',
          'critical',
        );
      } else if (printer.status === 'warning') {
        notify(
          `🟡 ${printer.name} — Warning`,
          `${Math.round(printer.daysRemaining)} day(s) remaining before maintenance is needed.`,
        );
      }
    }
  } catch {
    // Silently ignore — store may not be ready yet
  }

  // Run auto maintenance prints after checking statuses
  runAutoMaintenancePrints();
}

function notify(title: string, body: string, urgency: 'normal' | 'critical' = 'normal'): void {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body,
      urgency,
      silent: false,
    }).show();
  }
}
