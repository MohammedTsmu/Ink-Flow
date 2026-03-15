import { exec } from 'child_process';
import { Notification } from 'electron';
import { getStore } from './store';

let monitorInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Queries the Windows PrintService Operational event log for recent
 * "Document Printed" events (Event ID 307) and auto-logs maintenance
 * events for tracked printers.
 */
async function checkPrintEvents(): Promise<void> {
  try {
    const store = getStore();
    const lastCheck = store.getLastPrintCheckTime();
    const now = new Date();

    // Build a time filter — only events since last check
    const sinceMs = now.getTime() - new Date(lastCheck).getTime();
    const sinceSeconds = Math.max(Math.ceil(sinceMs / 1000), 60);

    const printers = store.getPrinters();
    if (printers.length === 0) {
      store.setLastPrintCheckTime(now.toISOString());
      return;
    }

    const events = await queryPrintLog(sinceSeconds);

    if (events.length === 0) {
      store.setLastPrintCheckTime(now.toISOString());
      return;
    }

    // Match events against tracked printer names (case-insensitive)
    const printerMap = new Map(printers.map(p => [p.name.toLowerCase(), p]));

    for (const evt of events) {
      const printerName = evt.printerName.toLowerCase();
      const matched = printerMap.get(printerName);
      if (!matched) continue;

      // Check if we already logged an event close to this time (avoid duplicates)
      const existingEvents = store.getEvents(matched.id);
      const evtTime = new Date(evt.timeCreated).getTime();
      const isDuplicate = existingEvents.some(e => {
        const diff = Math.abs(new Date(e.eventDate).getTime() - evtTime);
        return diff < 2 * 60 * 1000 && e.notes.includes('Auto-detected');
      });

      if (!isDuplicate) {
        store.addEvent({
          printerId: matched.id,
          eventType: 'print',
          notes: 'Auto-detected print job: ' + evt.documentName,
        });
      }
    }

    store.setLastPrintCheckTime(now.toISOString());
  } catch {
    // Silently ignore — log may be disabled or PowerShell may fail
  }
}

interface PrintEvent {
  timeCreated: string;
  printerName: string;
  documentName: string;
}

function queryPrintLog(sinceSeconds: number): Promise<PrintEvent[]> {
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

/**
 * Starts monitoring the Windows print spooler for real print jobs.
 * Checks every 5 minutes.
 */
export function startPrintMonitor(): void {
  // Run an initial check shortly after startup (30 seconds)
  setTimeout(() => { checkPrintEvents(); }, 30_000);

  // Then check every 5 minutes
  monitorInterval = setInterval(() => { checkPrintEvents(); }, 5 * 60 * 1000);
}

export function stopPrintMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
