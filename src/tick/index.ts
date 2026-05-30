/**
 * Ink Flow — headless maintenance tick.
 *
 * Runs out-of-process from the GUI. Triggered by the OS scheduler
 * (Task Scheduler on Windows, LaunchAgent on macOS, systemd --user
 * timer on Linux). Has no UI, no Electron — just Node.
 *
 * What it does:
 *  1. Read inkflow-data.json from the shared user-data directory.
 *  2. For each printer past its idle threshold (and with
 *     autoMaintenancePrint enabled), check connectivity.
 *  3. If online, send a test maintenance page via the platform adapter.
 *  4. Append the event back to the store; logs every action to
 *     diagnostics.log so the GUI's Diagnostics panel can show what
 *     happened while no one was watching.
 *
 * Invocation:
 *   electron --no-sandbox dist/tick/index.js --user-data=/path/to/dir
 *   (ELECTRON_RUN_AS_NODE=1 turns Electron into a Node runtime)
 */

import fs from 'fs';
import path from 'path';
import { resolveUserDataFromArgv } from '../core/paths';
import { initLogger, info, error, warn } from '../core/log';
import { calculateStatus } from '../core/status';
import { getAdapter } from '../core/printers';
import { StoreData, EventRecord } from '../core/types';

async function run(): Promise<void> {
  const userDataPath = resolveUserDataFromArgv();
  initLogger(userDataPath);
  info('tick', 'Tick run started', { userDataPath, pid: process.pid });

  const storePath = path.join(userDataPath, 'inkflow-data.json');
  const data = readStore(storePath);
  if (!data) {
    info('tick', 'No store file present — nothing to do', { storePath });
    return;
  }

  if (!data.settings?.autoMaintenancePrint) {
    info('tick', 'Auto-maintenance disabled in settings — skipping');
    return;
  }

  const adapter = getAdapter();
  let processed = 0;
  let printed = 0;
  let skippedOffline = 0;
  let failed = 0;

  for (const printer of data.printers) {
    processed++;
    const lastEvent = latestEventFor(data, printer.id);
    const { status } = calculateStatus(lastEvent, printer.maxIdleDays, printer.warningDays);
    if (status !== 'overdue' && status !== 'urgent') continue;

    const connectivity = await adapter.getStatus(printer.name);
    if (connectivity === 'offline') {
      warn('tick', 'Skipped: printer offline', { printer: printer.name });
      skippedOffline++;
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
      };
      data.events.push(newEvent);
      printed++;
      info('tick', 'Sent maintenance print', { printer: printer.name });
    } else {
      error('tick', 'Maintenance print failed', { printer: printer.name });
      failed++;
    }
  }

  if (printed > 0) writeStore(storePath, data);
  info('tick', 'Tick complete', { processed, printed, skippedOffline, failed });
}

function readStore(p: string): StoreData | null {
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw) as StoreData;
    if (!Array.isArray(parsed.printers) || !Array.isArray(parsed.events)) {
      warn('tick', 'Store file has unexpected shape', { storePath: p });
      return null;
    }
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    warn('tick', 'Could not read store file', err);
    return null;
  }
}

function writeStore(p: string, data: StoreData): void {
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, p);
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
