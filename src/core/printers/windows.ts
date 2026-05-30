import { exec, execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  PrinterAdapter,
  SystemPrinter,
  ConnectivityStatus,
  PrintEvent,
} from './types';

/**
 * Windows implementation of PrinterAdapter.
 *
 * Uses PowerShell cmdlets:
 *  - Get-Printer            for enumeration and cached status
 *  - Get-WinEvent           for PrintService/Operational event 307
 *  - notepad.exe /p         for AV-safe silent test print
 *
 * Limitations to be addressed in later phases:
 *  - PrinterStatus is the spooler's cached state, not the device.
 *    Phase 4.1 adds Get-PnpDevice / TCP probe for real off-detection.
 *  - The Operational event log is disabled by default on Windows.
 *    Phase 1.5 prompts the user to enable it on first run.
 *  - Print events are polled every 5 minutes. A real-time subscription
 *    (Register-WinEvent) is a follow-up improvement.
 */
export class WindowsAdapter implements PrinterAdapter {
  readonly platform = 'win32' as const;

  /** Tracks whether subscribers are seeing all events since this timestamp. */
  private lastEventCheckTime = new Date();

  listSystem(): Promise<SystemPrinter[]> {
    return new Promise((resolve) => {
      exec(
        'powershell -NoProfile -Command "Get-Printer | Select-Object Name,PortName,DriverName,Shared | ConvertTo-Json"',
        { timeout: 10000 },
        (error, stdout) => {
          if (error || !stdout.trim()) { resolve([]); return; }
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

  getStatus(name: string): Promise<ConnectivityStatus> {
    return new Promise((resolve) => {
      const safeName = name.replace(/'/g, "''");
      exec(
        "powershell -NoProfile -Command \"Get-Printer -Name '" + safeName + "' | Select-Object PrinterStatus | ConvertTo-Json\"",
        { timeout: 8000 },
        (error, stdout) => {
          if (error || !stdout.trim()) { resolve('unknown'); return; }
          try {
            const parsed = JSON.parse(stdout.trim());
            // PrinterStatus: 0 = Normal, 1 = Paused, 3 = Offline, 5 = ...
            const status = Number(parsed.PrinterStatus ?? parsed.printerStatus ?? -1);
            if (status === 0) resolve('online');
            else if (status === 1 || status === 3 || status === 5) resolve('offline');
            else resolve('online');
          } catch {
            resolve('unknown');
          }
        },
      );
    });
  }

  sendTestPrint(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 16).replace('T', ' ');
      const content = [
        'Ink Flow - Maintenance Print',
        'Date: ' + dateStr,
        'Printer: ' + name,
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

      // notepad /p prints silently; no shell, no AV false-positive.
      execFile('notepad.exe', ['/p', tempFile], { timeout: 30000 }, (error) => {
        try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
        resolve(!error);
      });
    });
  }

  subscribeToPrintEvents(callback: (event: PrintEvent) => void): () => void {
    // Initial check 30s after subscribe, then every 5 minutes.
    const initialTimeout = setTimeout(() => { this.pollEvents(callback); }, 30_000);
    const interval = setInterval(() => { this.pollEvents(callback); }, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }

  private async pollEvents(callback: (event: PrintEvent) => void): Promise<void> {
    try {
      const now = new Date();
      const sinceMs = now.getTime() - this.lastEventCheckTime.getTime();
      const sinceSeconds = Math.max(Math.ceil(sinceMs / 1000), 60);
      const events = await queryWindowsPrintLog(sinceSeconds);
      this.lastEventCheckTime = now;
      for (const evt of events) callback(evt);
    } catch {
      // Silently absorb — log may be disabled, PowerShell may fail.
      // Phase 1.4 replaces this with structured diagnostics.
    }
  }
}

function queryWindowsPrintLog(sinceSeconds: number): Promise<PrintEvent[]> {
  return new Promise((resolve) => {
    // Query Event ID 307 (Document Printed) from the PrintService Operational log
    // Properties: [0]=JobId, [1]=DocumentName, [2]=User, [3]=Machine, [4]=PrinterName
    const ps = [
      'try {',
      '  $events = Get-WinEvent -LogName "Microsoft-Windows-PrintService/Operational"',
      '    -FilterXPath "*[System[EventID=307 and TimeCreated[timediff(@SystemTime) <= ' + (sinceSeconds * 1000) + ']]]"',
      '    -MaxEvents 50 -ErrorAction Stop',
      '  $results = $events | ForEach-Object {',
      '    [PSCustomObject]@{',
      '      TimeCreated = $_.TimeCreated.ToString("o")',
      '      PrinterName = $_.Properties[4].Value',
      '      DocumentName = $_.Properties[1].Value',
      '    }',
      '  }',
      '  $results | ConvertTo-Json -Compress',
      '} catch { Write-Output "[]" }',
    ].join(' ');

    exec(
      'powershell -NoProfile -Command "' + ps.replace(/"/g, '\\"') + '"',
      { timeout: 15000 },
      (error, stdout) => {
        if (error || !stdout.trim() || stdout.trim() === '[]') {
          resolve([]);
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          const results: PrintEvent[] = list
            .filter((e: Record<string, unknown>) => e.PrinterName || e.printerName)
            .map((e: Record<string, unknown>) => ({
              timeCreated: String(e.TimeCreated || e.timeCreated || ''),
              printerName: String(e.PrinterName || e.printerName || ''),
              documentName: String(e.DocumentName || e.documentName || 'Unknown document'),
            }));
          resolve(results);
        } catch {
          resolve([]);
        }
      },
    );
  });
}
