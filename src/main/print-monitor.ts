import { getAdapter } from '../core/printers';
import { PrintEvent } from '../core/printers/types';
import { getStore } from './store';
import { error, info } from '../core/log';

let unsubscribe: (() => void) | null = null;

const DEDUP_WINDOW_MS = 2 * 60 * 1000;

function handlePrintEvent(evt: PrintEvent): void {
  try {
    const store = getStore();
    const printers = store.getPrinters();
    const printerMap = new Map(printers.map(p => [p.name.toLowerCase(), p]));

    const matched = printerMap.get(evt.printerName.toLowerCase());
    if (!matched) return;

    // Skip if we already logged a near-identical auto-detected event
    const existing = store.getEvents(matched.id);
    const evtTime = new Date(evt.timeCreated).getTime();
    const isDuplicate = existing.some(e => {
      const diff = Math.abs(new Date(e.eventDate).getTime() - evtTime);
      return diff < DEDUP_WINDOW_MS && e.notes.includes('Auto-detected');
    });

    if (!isDuplicate) {
      store.addEvent({
        printerId: matched.id,
        eventType: 'print',
        notes: 'Auto-detected print job: ' + evt.documentName,
        category: 'user',
      });
      info('print-monitor', 'Auto-logged print job', {
        printer: matched.name,
        document: evt.documentName,
      });
    }

    store.setLastPrintCheckTime(new Date().toISOString());
  } catch (err) {
    error('print-monitor', 'Failed to record print event', err);
  }
}

export function startPrintMonitor(): void {
  if (unsubscribe) return;
  const adapter = getAdapter();
  unsubscribe = adapter.subscribeToPrintEvents(handlePrintEvent);
  info('print-monitor', 'Print event subscription started');
}

export function stopPrintMonitor(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
