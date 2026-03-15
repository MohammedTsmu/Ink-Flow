import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getStore } from './store';
import { checkPrinterStatus } from './printer-detect';
import { Notification } from 'electron';

/**
 * Sends a minimal test page to a printer using Windows built-in printing.
 * Writes a text file with Node.js fs, then prints via notepad /p (silent print).
 * No shell or PowerShell involved — avoids antivirus false positives.
 */
export function sendTestPrint(printerName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 16).replace('T', ' ');
    const content = [
      'Ink Flow - Maintenance Print',
      'Date: ' + dateStr,
      'Printer: ' + printerName,
      '',
      'This page was printed automatically to keep your print head healthy.',
    ].join('\r\n');

    const tempFile = path.join(os.tmpdir(), 'inkflow-test-' + Date.now() + '.txt');

    try {
      fs.writeFileSync(tempFile, content, 'utf-8');
    } catch {
      resolve(false);
      return;
    }

    // Launch notepad.exe directly (no shell) with /p flag for silent print
    execFile('notepad.exe', ['/p', tempFile], { timeout: 30000 }, (error) => {
      // Clean up temp file regardless of print result
      try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
      resolve(!error);
    });
  });
}

/**
 * Check all printers and auto-print for those that are urgent/overdue
 * with autoMaintenancePrint enabled.
 */
export async function runAutoMaintenancePrints(): Promise<void> {
  try {
    const store = getStore();
    const printers = store.getPrintersWithStatus();

    for (const printer of printers) {
      if (printer.status === 'urgent' || printer.status === 'overdue') {
        const settings = store.getSettings();
        if (settings.autoMaintenancePrint) {
          const printerStatus = await checkPrinterStatus(printer.name);
          if (printerStatus === 'offline') {
            if (Notification.isSupported()) {
              new Notification({
                title: `Ink Flow — Printer Offline`,
                body: `"${printer.name}" needs maintenance but is offline. Please turn it on.`,
              }).show();
            }
            continue;
          }
          const success = await sendTestPrint(printer.name);
          if (success) {
            store.addEvent({
              printerId: printer.id,
              eventType: 'print',
              notes: 'Auto maintenance print',
            });
            if (Notification.isSupported()) {
              new Notification({
                title: `Ink Flow — Auto Print`,
                body: `Sent maintenance print to "${printer.name}" to keep the nozzles healthy.`,
              }).show();
            }
          }
        }
      }
    }
  } catch {
    // Silently ignore
  }
}
