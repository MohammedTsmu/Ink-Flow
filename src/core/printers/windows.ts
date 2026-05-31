import { exec, execFile, spawn, ChildProcess } from 'child_process';
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
import { generateColorTestPng } from '../color-test-image';

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
      const ts = Date.now();
      const imagePath = path.join(os.tmpdir(), `inkflow-color-${ts}.png`);
      const scriptPath = path.join(os.tmpdir(), `inkflow-print-${ts}.ps1`);

      try {
        fs.writeFileSync(imagePath, generateColorTestPng());
      } catch (err) {
        error('windows-adapter', 'Could not write color-test image', err);
        resolve(false);
        return;
      }

      // Why a .ps1 file with proper multi-line and no -NonInteractive:
      // GDI+ PrintDocument needs a window-station / desktop context to
      // get a device-context handle for the printer. `-NonInteractive`
      // strips that and Print() fails with "The handle is invalid".
      // Also -Command with ; separators tended to drop the add_PrintPage
      // binding before Print() ran. -File with a real script is reliable.
      const safeName = name.replace(/'/g, "''");
      const safePath = imagePath.replace(/'/g, "''");
      const scriptBody = `$ErrorActionPreference = 'Stop'
try {
  Add-Type -AssemblyName System.Drawing
  $img = [System.Drawing.Image]::FromFile('${safePath}')
  $doc = New-Object System.Drawing.Printing.PrintDocument
  $doc.PrinterSettings.PrinterName = '${safeName}'
  $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(50, 50, 50, 50)
  $doc.add_PrintPage({
    param($s, $e)
    $e.Graphics.DrawImage($img, $e.MarginBounds)
  })
  try { $doc.Print() } finally { $img.Dispose() }
  Write-Output 'OK'
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`;

      try {
        fs.writeFileSync(scriptPath, scriptBody, 'utf-8');
      } catch (err) {
        try { fs.unlinkSync(imagePath); } catch { /* ignore */ }
        error('windows-adapter', 'Could not write print script', err);
        resolve(false);
        return;
      }

      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        { timeout: 30_000 },
        (err, _stdout, stderr) => {
          try { fs.unlinkSync(imagePath); } catch { /* ignore */ }
          try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }
          if (err) {
            error('windows-adapter', 'PowerShell test print failed', {
              code: err.code,
              stderr: String(stderr || '').slice(0, 500),
            });
            resolve(false);
          } else {
            resolve(true);
          }
        },
      );
    });
  }

  subscribeToPrintEvents(callback: (event: PrintEvent) => void): () => void {
    // Real-time subscription via a long-lived PowerShell process running
    // a .NET EventLogWatcher on the PrintService/Operational log. Events
    // are pushed as JSONL on stdout. We restart on crash with a 5 s
    // backoff so transient PowerShell failures don't kill detection.
    let stopped = false;
    let proc: ChildProcess | null = null;
    let restartTimer: NodeJS.Timeout | null = null;
    let stdoutBuffer = '';

    const scriptPath = path.join(os.tmpdir(), 'inkflow-print-watcher.ps1');
    try {
      fs.writeFileSync(scriptPath, WATCHER_PS_SCRIPT, 'utf-8');
    } catch (err) {
      error('windows-adapter', 'Failed to stage print-watcher PS script', err);
      return () => { /* nothing to clean up */ };
    }

    const onLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const obj = JSON.parse(trimmed) as { timeCreated?: string; printerName?: string; documentName?: string };
        if (!obj.printerName) return;
        callback({
          timeCreated: obj.timeCreated || new Date().toISOString(),
          printerName: String(obj.printerName),
          documentName: String(obj.documentName || 'Unknown document'),
        });
      } catch {
        // Non-JSON output (status / error from PS) — ignored on purpose.
      }
    };

    const start = () => {
      if (stopped) return;
      try {
        proc = spawn('powershell.exe', [
          '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
          '-ExecutionPolicy', 'Bypass', '-File', scriptPath,
        ], { stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (err) {
        error('windows-adapter', 'Could not spawn print-watcher', err);
        return;
      }

      const stdout = proc.stdout;
      if (stdout) {
        stdout.setEncoding('utf-8');
        stdout.on('data', (chunk: string) => {
          stdoutBuffer += chunk;
          let nl: number;
          while ((nl = stdoutBuffer.indexOf('\n')) >= 0) {
            const line = stdoutBuffer.slice(0, nl);
            stdoutBuffer = stdoutBuffer.slice(nl + 1);
            onLine(line);
          }
        });
      }
      proc.on('exit', (code) => {
        if (stopped) return;
        warn('windows-adapter', 'print-watcher exited; restarting', { code });
        restartTimer = setTimeout(start, 5000);
      });

      info('windows-adapter', 'print-watcher running (real-time)');
    };

    start();

    return () => {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      try { proc?.kill(); } catch { /* ignore */ }
      try { fs.unlinkSync(scriptPath); } catch { /* ignore */ }
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

}

/**
 * PowerShell script staged to a temp .ps1 file and run with `-File`.
 * Uses .NET's EventLogWatcher so we get a callback fired on every new
 * Event ID 307 in real time. Each event is serialised to compact JSON
 * on a single stdout line; the Node parent reads and dispatches.
 */
const WATCHER_PS_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
  $logName = 'Microsoft-Windows-PrintService/Operational'
  $xpath   = '*[System[EventID=307]]'
  $query   = New-Object System.Diagnostics.Eventing.Reader.EventLogQuery($logName, [System.Diagnostics.Eventing.Reader.PathType]::LogName, $xpath)
  $watcher = New-Object System.Diagnostics.Eventing.Reader.EventLogWatcher($query)
  $null = Register-ObjectEvent -InputObject $watcher -EventName 'EventRecordWritten' -Action {
    try {
      $rec = $EventArgs.EventRecord
      if ($null -eq $rec) { return }
      $obj = @{
        timeCreated  = $rec.TimeCreated.ToString('o')
        printerName  = $rec.Properties[4].Value
        documentName = $rec.Properties[1].Value
      }
      [Console]::Out.WriteLine((ConvertTo-Json -Compress $obj))
      [Console]::Out.Flush()
    } catch {
      [Console]::Error.WriteLine("watcher-callback: $_")
    }
  }
  $watcher.Enabled = $true
  while ($true) { Start-Sleep -Seconds 3600 }
} catch {
  [Console]::Error.WriteLine("watcher-startup: $_")
  exit 1
}
`.trim();
