import { Notification } from 'electron';
import { getAdapter } from '../core/printers';
import { getStore } from './store';

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
        if (Notification.isSupported()) {
          new Notification({
            title: 'Ink Flow — Auto Print',
            body: `Sent maintenance print to "${printer.name}" to keep the nozzles healthy.`,
          }).show();
        }
      }
    }
  } catch {
    // Phase 1.4 replaces with structured diagnostics.
  }
}
