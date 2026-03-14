import { exec } from 'child_process';
import { getStore } from './store';
import { Notification } from 'electron';

/**
 * Sends a minimal test page to a printer using Windows built-in printing.
 * Creates a tiny text file and prints it via notepad /p (silent print).
 */
export function sendTestPrint(printerName: string): Promise<boolean> {
  return new Promise((resolve) => {
    const escapedName = printerName.replace(/'/g, "''");
    // Build the PowerShell script as a plain string to avoid TS template issues
    const lines = [
      '$text = "Ink Flow - Maintenance Print" + [char]10 + "Date: " + (Get-Date -Format "yyyy-MM-dd HH:mm") + [char]10 + "Printer: ' + escapedName + '" + [char]10 + "This page was printed automatically to keep your print head healthy."',
      '$tempFile = Join-Path $env:TEMP ("inkflow-test-" + (Get-Random) + ".txt")',
      '$text | Out-File -FilePath $tempFile -Encoding UTF8',
      '$p = Start-Process -FilePath "notepad.exe" -ArgumentList ("/p " + $tempFile) -PassThru -WindowStyle Hidden',
      'Start-Sleep -Seconds 5',
      'if (!$p.HasExited) { $p.Kill() }',
      'Remove-Item $tempFile -ErrorAction SilentlyContinue',
    ].join('; ');

    exec(
      'powershell -NoProfile -Command "' + lines.replace(/"/g, '\\"') + '"',
      { timeout: 30000 },
      (error) => {
        resolve(!error);
      },
    );
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
