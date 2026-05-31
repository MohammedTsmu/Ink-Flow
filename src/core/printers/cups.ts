import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  PrinterAdapter,
  SystemPrinter,
  ConnectivityStatus,
  PrintEvent,
  DetectionStatus,
  DetectionFixResult,
  SupportedPlatform,
} from './types';
import { error, warn, info } from '../log';
import { probeTcp, extractIpv4, RAW_PRINT_PORT } from '../net';
import { generateColorTestPng } from '../color-test-image';

/**
 * CUPS adapter — covers both macOS and Linux. CUPS is the standard
 * print system on both, with an identical CLI surface (lpstat, lp).
 *
 * Auto-detection works by tailing CUPS' page_log file. Default paths:
 *   Linux  : /var/log/cups/page_log
 *   macOS  : /private/var/log/cups/page_log     (Full Disk Access prompt)
 *
 * Format of each line:
 *   <printer> <user> <job-id> [<date time>] <pages> <copies> <billing> <host>
 *
 * The adapter watches the file with fs.watch and emits one PrintEvent
 * per new line. If the file rotates (logrotate truncates / replaces),
 * the watcher reattaches.
 */
export class CupsAdapter implements PrinterAdapter {
  readonly platform: SupportedPlatform;
  private readonly pageLogPath: string;

  constructor(platform: 'darwin' | 'linux') {
    this.platform = platform;
    this.pageLogPath = platform === 'darwin'
      ? '/private/var/log/cups/page_log'
      : '/var/log/cups/page_log';
  }

  listSystem(): Promise<SystemPrinter[]> {
    return new Promise((resolve) => {
      execFile('lpstat', ['-p'], { timeout: 8000 }, (err, stdout) => {
        if (err || !stdout) { resolve([]); return; }
        const printers: SystemPrinter[] = [];
        for (const line of stdout.split('\n')) {
          // "printer NAME is idle. enabled since ..."
          const m = /^printer\s+(\S+)\s+is\s+/i.exec(line);
          if (m) printers.push({ name: m[1] });
        }
        resolve(printers);
      });
    });
  }

  async getStatus(name: string): Promise<ConnectivityStatus> {
    // For network printers, prefer a live TCP probe to the raw-print
    // port over CUPS' own state, which can lag the device for minutes.
    const deviceUri = await this.getDeviceUri(name);
    const ip = deviceUri ? extractIpv4(deviceUri) : null;
    if (ip) {
      const portMatch = /:(\d+)(?:[/?]|$)/.exec(deviceUri!);
      const port = portMatch ? Number(portMatch[1]) : RAW_PRINT_PORT;
      return probeTcp(ip, port, 3000);
    }
    // USB or driverless — fall back to lpstat -p
    return this.lpstatStatus(name);
  }

  private getDeviceUri(name: string): Promise<string | null> {
    return new Promise((resolve) => {
      execFile('lpstat', ['-v', name], { timeout: 8000 }, (err, stdout) => {
        if (err || !stdout) { resolve(null); return; }
        // Format: "device for NAME: socket://10.0.0.4:9100"
        const m = /:\s*(\S+)\s*$/.exec(stdout.trim());
        resolve(m ? m[1] : null);
      });
    });
  }

  private lpstatStatus(name: string): Promise<ConnectivityStatus> {
    return new Promise((resolve) => {
      execFile('lpstat', ['-p', name], { timeout: 8000 }, (err, stdout) => {
        if (err || !stdout) { resolve('unknown'); return; }
        const lower = stdout.toLowerCase();
        if (/\bis\s+(idle|processing|printing)\b/.test(lower)) resolve('online');
        else if (/\bis\s+(stopped|disabled|paused|offline)\b/.test(lower)) resolve('offline');
        else resolve('unknown');
      });
    });
  }

  sendTestPrint(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      const imagePath = path.join(os.tmpdir(), 'inkflow-color-' + Date.now() + '.png');
      try {
        fs.writeFileSync(imagePath, generateColorTestPng());
      } catch (err) {
        error('cups-adapter', 'Could not write color-test image', err);
        resolve(false);
        return;
      }

      // CUPS includes a PNG filter by default — `lp` rasterises through
      // the driver and exercises every ink channel.
      execFile('lp', ['-d', name, imagePath], { timeout: 30_000 }, (err) => {
        try { fs.unlinkSync(imagePath); } catch { /* ignore */ }
        if (err) {
          error('cups-adapter', 'lp failed', err);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  subscribeToPrintEvents(callback: (event: PrintEvent) => void): () => void {
    let stopped = false;
    let lastSize = 0;
    let watcher: fs.FSWatcher | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    try {
      if (fs.existsSync(this.pageLogPath)) {
        lastSize = fs.statSync(this.pageLogPath).size;
      }
    } catch {
      // File may not exist yet — that's fine, we'll pick it up on first change.
    }

    const flush = () => {
      if (stopped) return;
      try {
        if (!fs.existsSync(this.pageLogPath)) return;
        const stat = fs.statSync(this.pageLogPath);
        if (stat.size < lastSize) {
          // File rotated (truncated / replaced). Re-start from beginning.
          lastSize = 0;
        }
        if (stat.size === lastSize) return;
        const fd = fs.openSync(this.pageLogPath, 'r');
        const buf = Buffer.alloc(stat.size - lastSize);
        fs.readSync(fd, buf, 0, buf.length, lastSize);
        fs.closeSync(fd);
        lastSize = stat.size;
        const text = buf.toString('utf-8');
        for (const line of text.split('\n')) {
          const evt = parsePageLogLine(line);
          if (evt) callback(evt);
        }
      } catch (err) {
        warn('cups-adapter', 'page_log read failed', err);
      }
    };

    try {
      watcher = fs.watch(this.pageLogPath, { persistent: false }, flush);
    } catch {
      // The file may not exist yet (CUPS not installed / never printed).
      // Fall back to polling every 30s so we still pick up later writes.
    }

    // Safety net: poll every 30 s even when fs.watch is in place. Some
    // platforms drop watch events on log-rotate or NFS mounts.
    pollInterval = setInterval(flush, 30_000);

    return () => {
      stopped = true;
      try { watcher?.close(); } catch { /* ignore */ }
      if (pollInterval) clearInterval(pollInterval);
    };
  }

  async checkDetectionStatus(): Promise<DetectionStatus> {
    try {
      const stat = fs.statSync(this.pageLogPath);
      if (stat.size === 0) {
        return {
          available: true,
          reason: `CUPS page log is present but empty. Auto-detection will activate on the next print job. (${this.pageLogPath})`,
          fixable: false,
        };
      }
      return {
        available: true,
        reason: `CUPS page log is readable. Auto-detection active. (${this.pageLogPath})`,
        fixable: false,
      };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EACCES' || code === 'EPERM') {
        return {
          available: false,
          reason: `Cannot read ${this.pageLogPath}. ${this.platform === 'darwin'
            ? 'Grant Ink Flow Full Disk Access in System Settings → Privacy & Security.'
            : 'Run: sudo chmod 644 /var/log/cups/page_log  (or add your user to the lpadmin group).'}`,
          fixable: false,
          actionHint: this.platform === 'darwin' ? 'Open System Settings' : 'See instructions',
        };
      }
      if (code === 'ENOENT') {
        return {
          available: false,
          reason: `CUPS page log not found at ${this.pageLogPath}. Is CUPS installed and configured to log pages?`,
          fixable: false,
        };
      }
      return {
        available: false,
        reason: `Could not access CUPS page log: ${String(err)}`,
        fixable: false,
      };
    }
  }

  async attemptFixDetection(): Promise<DetectionFixResult> {
    // macOS: the only fix path is for the user to grant Ink Flow Full
    // Disk Access to the CUPS log directory. We can't grant it ourselves,
    // but we can deep-link straight to the right System Settings pane so
    // the user only has to click "+", pick Ink Flow, then restart the app.
    if (this.platform === 'darwin') {
      const status = await this.checkDetectionStatus();
      if (!status.available) {
        return new Promise((resolve) => {
          execFile(
            'open',
            ['x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'],
            { timeout: 5000 },
            (err) => {
              if (err) {
                warn('cups-adapter', 'Could not open System Settings', err);
                resolve({
                  success: false,
                  reason: 'Open System Settings → Privacy & Security → Full Disk Access and add Ink Flow manually.',
                });
                return;
              }
              info('cups-adapter', 'Opened FDA pane in System Settings');
              resolve({
                success: false, // Still false until the user grants + restarts.
                reason: 'Opened System Settings. Click the "+" button, add Ink Flow, then restart the app.',
              });
            },
          );
        });
      }
      // Already OK on macOS.
      return { success: true };
    }

    // Linux: no automatic path. User needs to chmod or join lpadmin.
    info('cups-adapter', 'No automatic fix path on Linux — user instructions only');
    return {
      success: false,
      reason: 'Run: sudo chmod 644 /var/log/cups/page_log  (or add your user to the lpadmin group, then log out and back in).',
    };
  }
}

/**
 * Parse a CUPS page_log line. Returns null for blank or unrecognised lines.
 *
 * Sample line:
 *   HP_LaserJet root 123 [01/Jan/2025:14:30:00 +0000] 1 1 - 192.168.1.5
 *
 * Field 4 (the bracketed timestamp) may contain spaces; we split on
 * spaces but keep the bracket-grouped timestamp intact.
 */
export function parsePageLogLine(line: string): PrintEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const bracketStart = trimmed.indexOf('[');
  const bracketEnd = trimmed.indexOf(']');
  if (bracketStart < 0 || bracketEnd < 0 || bracketEnd < bracketStart) return null;

  const before = trimmed.slice(0, bracketStart).trim().split(/\s+/);
  if (before.length < 3) return null;

  const printer = before[0];
  // before[1] is user, before[2] is job-id
  const dateRaw = trimmed.slice(bracketStart + 1, bracketEnd);

  return {
    printerName: printer,
    timeCreated: cupsDateToIso(dateRaw),
    documentName: `Job ${before[2]}`,
  };
}

function cupsDateToIso(raw: string): string {
  // Example: "01/Jan/2025:14:30:00 +0000"
  const match = /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+\-]\d{4})?$/.exec(raw);
  if (!match) return new Date().toISOString();
  const [, dd, mon, yyyy, hh, mm, ss, tz] = match;
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };
  const m = months[mon] || '01';
  const tzNormalised = tz ? tz.slice(0, 3) + ':' + tz.slice(3) : 'Z';
  return `${yyyy}-${m}-${dd}T${hh}:${mm}:${ss}${tzNormalised}`;
}
