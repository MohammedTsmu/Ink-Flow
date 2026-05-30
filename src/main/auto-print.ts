import { Notification } from 'electron';
import { getAdapter } from '../core/printers';
import { getStore } from './store';
import { error, info, warn } from '../core/log';

/** Send a single maintenance test page. Delegates to the platform adapter. */
export function sendTestPrint(printerName: string): Promise<boolean> {
  return getAdapter().sendTestPrint(printerName);
}

/**
 * Check all printers and auto-print for those that are urgent/overdue
 * with autoMaintenancePrint enabled.
 */
export async function runAutoMaintenancePrints(): Promise<void> {
  try {
    const adapter = getAdapter();
    const store = getStore();
    const printers = store.getPrintersWithStatus();

    for (const printer of printers) {
      if (printer.status !== 'urgent' && printer.status !== 'overdue') continue;

      const settings = store.getSettings();
      if (!settings.autoMaintenancePrint) continue;

      const connectivity = await adapter.getStatus(printer.name);
      if (connectivity === 'offline') {
        warn('auto-print', 'Skipped: printer offline', { printer: printer.name });
        if (Notification.isSupported()) {
          new Notification({
            title: 'Ink Flow — Printer Offline',
            body: `"${printer.name}" needs maintenance but is offline. Please turn it on.`,
          }).show();
        }
        continue;
      }

      const success = await adapter.sendTestPrint(printer.name);
      if (success) {
        store.addEvent({
          printerId: printer.id,
          eventType: 'print',
          notes: 'Auto maintenance print',
        });
        info('auto-print', 'Sent maintenance print', { printer: printer.name });
        if (Notification.isSupported()) {
          new Notification({
            title: 'Ink Flow — Auto Print',
            body: `Sent maintenance print to "${printer.name}" to keep the nozzles healthy.`,
          }).show();
        }
      } else {
        error('auto-print', 'Maintenance print failed', { printer: printer.name });
      }
    }
  } catch (err) {
    error('auto-print', 'runAutoMaintenancePrints crashed', err);
  }
}
