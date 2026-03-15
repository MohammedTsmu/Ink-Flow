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
        const daysOverdue = Math.abs(Math.round(printer.daysRemaining * 10) / 10);
        let body: string;
        let title: string;

        if (daysOverdue >= printer.maxIdleDays * 2) {
          // Severely overdue — 2x the max idle time
          title = `🚨 CRITICAL: ${printer.name}`;
          body = `${daysOverdue} days overdue! Nozzles are very likely clogged. Turn on the printer and run a deep clean cycle immediately.`;
        } else if (daysOverdue >= printer.maxIdleDays) {
          // Very overdue — past the max again
          title = `🚨 ${printer.name} — SEVERELY OVERDUE`;
          body = `${daysOverdue} days overdue! High risk of permanent nozzle damage. Turn on and clean ASAP.`;
        } else {
          title = `⚠ ${printer.name} — OVERDUE`;
          body = `${daysOverdue} day(s) overdue. Print or clean this printer soon to prevent clogging.`;
        }

        notify(title, body, 'critical');
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
