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
