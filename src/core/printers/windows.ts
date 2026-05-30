import { exec, execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  PrinterAdapter,
  SystemPrinter,
  ConnectivityStatus,
  PrintEvent,
  DetectionStatus,
  DetectionFixResult,
} from './types';
import { error, info, warn } from '../log';
import { probeTcp, extractIpv4, RAW_PRINT_PORT } from '../net';

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

  async getStatus(name: string): Promise<ConnectivityStatus> {
    // First, ask the spooler for the port. If it's a network port we
    // can do a live TCP probe — far more reliable than the spooler's
    // cached PrinterStatus, which is the root cause of "Ink Flow doesn't
    // notice when my printer is off".
    const portName = await this.getPortName(name);
    const ip = portName ? extractIpv4(portName) : null;
    if (ip) {
      return probeTcp(ip, RAW_PRINT_PORT, 3000);
    }
    // USB / LPT / WSD-non-IP — fall back to the cached spooler status.
    return this.cachedSpoolerStatus(name);
  }

  private getPortName(name: string): Promise<string | null> {
    return new Promise((resolve) => {
      const safeName = name.replace(/'/g, "''");
      exec(
        "powershell -NoProfile -Command \"(Get-Printer -Name '" + safeName + "' -ErrorAction SilentlyContinue).PortName\"",
        { timeout: 8000 },
        (err, stdout) => {
          if (err) { resolve(null); return; }
          const value = stdout.trim();
          resolve(value || null);
        },
      );
    });
  }

  private cachedSpoolerStatus(name: string): Promise<ConnectivityStatus> {
    return new Promise((resolve) => {
      const safeName = name.replace(/'/g, "''");
      exec(
        "powershell -NoProfile -Command \"Get-Printer -Name '" + safeName + "' | Select-Object PrinterStatus | ConvertTo-Json\"",
        { timeout: 8000 },
        (err, stdout) => {
          if (err || !stdout.trim()) { resolve('unknown'); return; }
          try {
            const parsed = JSON.parse(stdout.trim());
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

  checkDetectionStatus(): Promise<DetectionStatus> {
    return new Promise((resolve) => {
      exec(
        'wevtutil gl Microsoft-Windows-PrintService/Operational',
        { timeout: 8000 },
        (err, stdout) => {
          if (err) {
            warn('windows-adapter', 'wevtutil gl failed', err);
            resolve({
              available: false,
              reason: 'Could not query the Windows event-log subsystem (wevtutil).',
              fixable: false,
            });
            return;
          }
          const match = /enabled:\s*(true|false)/i.exec(stdout);
          if (!match) {
            resolve({
              available: false,
              reason: 'Unexpected wevtutil output — could not determine log state.',
              fixable: false,
            });
            return;
          }
          const enabled = match[1].toLowerCase() === 'true';
          if (enabled) {
            resolve({
              available: true,
              reason: 'Windows PrintService Operational log is enabled. Auto-detection active.',
              fixable: false,
            });
          } else {
            resolve({
              available: false,
              reason: 'The Windows PrintService Operational log is disabled. Auto-detection of print jobs cannot work until it is enabled.',
              fixable: true,
              actionHint: 'Enable (requires administrator approval).',
            });
          }
        },
      );
    });
  }

  attemptFixDetection(): Promise<DetectionFixResult> {
    return new Promise((resolve) => {
      // Try unprivileged first (works if Ink Flow itself runs as admin).
      exec(
        'wevtutil sl Microsoft-Windows-PrintService/Operational /e:true',
        { timeout: 8000 },
        (err) => {
          if (!err) {
            info('windows-adapter', 'Enabled PrintService Operational log (no elevation needed)');
            resolve({ success: true });
            return;
          }
          // Escalate via UAC. Start-Process -Verb RunAs triggers the prompt.
          const elevatedCmd =
            "Start-Process wevtutil -ArgumentList 'sl','Microsoft-Windows-PrintService/Operational','/e:true' -Verb RunAs -Wait";
          execFile(
            'powershell.exe',
            ['-NoProfile', '-Command', elevatedCmd],
            { timeout: 60000 },
            (elevErr) => {
              if (elevErr) {
                warn('windows-adapter', 'Elevated wevtutil failed (likely UAC declined)', elevErr);
                resolve({
                  success: false,
                  reason: 'Could not enable the print log. You may have declined the administrator prompt.',
                });
                return;
              }
              // Verify it actually flipped to enabled.
              this.checkDetectionStatus().then(status => {
                if (status.available) {
                  info('windows-adapter', 'Enabled PrintService Operational log via UAC');
                  resolve({ success: true });
                } else {
                  resolve({
                    success: false,
                    reason: 'Elevation succeeded but the log is still reporting as disabled.',
                  });
                }
              });
            },
          );
        },
      );
    });
  }

  private async pollEvents(callback: (event: PrintEvent) => void): Promise<void> {
    try {
      const now = new Date();
      const sinceMs = now.getTime() - this.lastEventCheckTime.getTime();
      const sinceSeconds = Math.max(Math.ceil(sinceMs / 1000), 60);
      const events = await queryWindowsPrintLog(sinceSeconds);
      this.lastEventCheckTime = now;
      for (const evt of events) callback(evt);
    } catch (err) {
      error('windows-adapter', 'pollEvents failed', err);
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
