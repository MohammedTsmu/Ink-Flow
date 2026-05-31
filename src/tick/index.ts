/**
 * Ink Flow — headless maintenance tick.
 *
 * Runs out-of-process from the GUI. Triggered by the OS scheduler
 * (Task Scheduler on Windows, LaunchAgent on macOS, systemd --user
 * timer on Linux). Has no UI, no Electron — just Node.
 *
 * What it does:
 *  1. Acquire a cross-process exclusive lock on the store file.
 *  2. Read inkflow-data.json from the shared user-data directory.
 *  3. For each printer past its idle threshold (and with
 *     autoMaintenancePrint enabled), check connectivity.
 *  4. If online, send a test maintenance page via the platform adapter.
 *  5. Append the event back to the store; release the lock.
 *  6. Log every action to diagnostics.log so the GUI's Diagnostics
 *     panel can show what happened while no one was watching.
 *
 * Invocation:
 *   electron --no-sandbox dist/tick/index.js --user-data=/path/to/dir
 *   (ELECTRON_RUN_AS_NODE=1 turns Electron into a Node runtime)
 */

import path from 'path';
import { resolveUserDataFromArgv } from '../core/paths';
import { initLogger, info, error, warn } from '../core/log';
import { calculateStatus } from '../core/status';
import { getAdapter } from '../core/printers';
import { StoreData, EventRecord } from '../core/types';
import { readStoreFile, writeStoreFileAtomic, withStoreLock } from '../core/store-io';
import { isWithinMaintenanceWindow } from '../core/maintenance-window';

async function run(): Promise<void> {
  const userDataPath = resolveUserDataFromArgv();
  initLogger(userDataPath);
  info('tick', 'Tick run started', { userDataPath, pid: process.pid });

  const storePath = path.join(userDataPath, 'inkflow-data.json');

  await withStoreLock(storePath, async () => {
    const data = readStoreFile(storePath);
    if (!data) {
      info('tick', 'No usable store file — nothing to do', { storePath });
      return;
    }

    if (!data.settings?.autoMaintenancePrint) {
      info('tick', 'Auto-maintenance disabled in settings — skipping');
      return;
    }

    const maintenanceWindow = data.settings.maintenanceWindow ?? { startHour: 0, endHour: 24 };
    if (!isWithinMaintenanceWindow(maintenanceWindow)) {
      info('tick', 'Outside maintenance window — skipping', maintenanceWindow);
      return;
    }

    const adapter = getAdapter();
    const summary = { processed: 0, printed: 0, skippedOffline: 0, skippedOptOut: 0, failed: 0 };

    for (const printer of data.printers) {
      summary.processed++;
      if (printer.autoMaintain === false) {
        summary.skippedOptOut++;
        continue;
      }
      const lastEvent = latestEventFor(data, printer.id);
      const { status } = calculateStatus(lastEvent, printer.maxIdleDays, printer.warningDays);
      if (status !== 'overdue' && status !== 'urgent') continue;

      const connectivity = await adapter.getStatus(printer.name);
      if (connectivity === 'offline') {
        warn('tick', 'Skipped: printer offline', { printer: printer.name });
        summary.skippedOffline++;
        continue;
      }

      const ok = await adapter.sendTestPrint(printer.name);
      if (ok) {
        const newEvent: EventRecord = {
          id: data.nextEventId++,
          printerId: printer.id,
          eventType: 'print',
          eventDate: new Date().toISOString(),
          notes: 'Headless maintenance tick',
          category: 'maintenance',
        };
        data.events.push(newEvent);
        summary.printed++;
        info('tick', 'Sent maintenance print', { printer: printer.name });
      } else {
        error('tick', 'Maintenance print failed', { printer: printer.name });
        summary.failed++;
      }
    }

    if (summary.printed > 0) writeStoreFileAtomic(storePath, data);
    info('tick', 'Tick complete', summary);
  });
}

function latestEventFor(data: StoreData, printerId: number): EventRecord | null {
  let latest: EventRecord | null = null;
  for (const e of data.events) {
    if (e.printerId !== printerId) continue;
    if (!latest || new Date(e.eventDate).getTime() > new Date(latest.eventDate).getTime()) {
      latest = e;
    }
  }
  return latest;
}

run().catch((err) => {
  error('tick', 'Unhandled crash', err);
  process.exit(1);
});
