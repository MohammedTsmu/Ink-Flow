import { exec } from 'child_process';

export interface SystemPrinter {
  name: string;
  portName: string;
  driverName: string;
  shared: boolean;
}

export function detectSystemPrinters(): Promise<SystemPrinter[]> {
  return new Promise((resolve) => {
    exec(
      'powershell -NoProfile -Command "Get-Printer | Select-Object Name,PortName,DriverName,Shared | ConvertTo-Json"',
      { timeout: 10000 },
      (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve([]);
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const printers: SystemPrinter[] = list.map((p: Record<string, unknown>) => ({
            name: String(p.Name || ''),
            portName: String(p.PortName || ''),
            driverName: String(p.DriverName || ''),
            shared: Boolean(p.Shared),
          }));
          resolve(printers);
        } catch {
          resolve([]);
        }
      },
    );
  });
}

/**
 * Checks if a specific printer is online/ready by querying its PrinterStatus.
 * Returns 'online', 'offline', or 'unknown'.
 */
export function checkPrinterStatus(printerName: string): Promise<'online' | 'offline' | 'unknown'> {
  return new Promise((resolve) => {
    const safeName = printerName.replace(/'/g, "''");
    exec(
      "powershell -NoProfile -Command \"Get-Printer -Name '" + safeName + "' | Select-Object PrinterStatus | ConvertTo-Json\"",
      { timeout: 8000 },
      (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve('unknown');
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          // PrinterStatus: 0 = Normal, 1 = Paused, 3 = Offline, etc.
          const status = Number(parsed.PrinterStatus ?? parsed.printerStatus ?? -1);
          if (status === 0) {
            resolve('online');
          } else if (status === 1 || status === 3 || status === 5) {
            resolve('offline');
          } else {
            // Other statuses (2=error, 4=paper jam, etc.) — treat as online but problematic
            resolve('online');
          }
        } catch {
          resolve('unknown');
        }
      },
    );
  });
}
