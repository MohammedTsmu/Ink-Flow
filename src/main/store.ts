import path from 'path';
import { app } from 'electron';
import {
  PrinterRecord,
  EventRecord,
  AppSettings,
  StoreData,
} from '../core/types';
import { calculateStatus } from '../core/status';
import { error, warn, info } from '../core/log';
import {
  readStoreFile,
  writeStoreFileAtomic,
  mtimeOf,
  emptyStore,
} from '../core/store-io';

export type { PrinterRecord, EventRecord, AppSettings } from '../core/types';

class Store {
  private data!: StoreData;
  private filePath: string;
  private lastReadMtime = 0;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'inkflow-data.json');
    this.load();
  }

  private load(): void {
    const fromDisk = readStoreFile(this.filePath);
    if (fromDisk) {
      this.data = fromDisk;
      this.migrate();
    } else {
      this.data = emptyStore();
      this.save();
    }
    this.lastReadMtime = mtimeOf(this.filePath);
  }

  /**
   * Re-read from disk if the file has been modified externally (e.g. by
   * the headless tick). Cheap mtime probe; only re-reads when newer.
   */
  private refreshIfStale(): void {
    const onDisk = mtimeOf(this.filePath);
    if (onDisk > this.lastReadMtime + 1) {
      const fresh = readStoreFile(this.filePath);
      if (fresh) {
        this.data = fresh;
        this.migrate();
        this.lastReadMtime = onDisk;
        info('store', 'Refreshed from disk (external change detected)');
      }
    }
  }

  /** Ensure all fields exist for data created by older versions. */
  private migrate(): void {
    if (!this.data.settings) {
      this.data.settings = {
        autoMaintenancePrint: false,
        theme: 'dark',
        maintenanceWindow: { startHour: 0, endHour: 24 },
        tickIntervalSeconds: 6 * 60 * 60,
      };
    }
    if (!this.data.settings.maintenanceWindow) {
      this.data.settings.maintenanceWindow = { startHour: 0, endHour: 24 };
    }
    if (typeof this.data.settings.tickIntervalSeconds !== 'number' || this.data.settings.tickIntervalSeconds < 60) {
      this.data.settings.tickIntervalSeconds = 6 * 60 * 60;
    }
    if (!this.data.lastPrintCheckTime) {
      this.data.lastPrintCheckTime = new Date().toISOString();
    }
    if (!Array.isArray(this.data.printers)) this.data.printers = [];
    if (!Array.isArray(this.data.events)) this.data.events = [];
    // Backfill autoMaintain — pre-v3 records didn't have it; default true.
    for (const p of this.data.printers) {
      if (typeof p.autoMaintain !== 'boolean') p.autoMaintain = true;
    }
    // Recalculate ID counters to prevent duplicates
    const maxPrinterId = this.data.printers.reduce((m, p) => Math.max(m, p.id), 0);
    const maxEventId = this.data.events.reduce((m, e) => Math.max(m, e.id), 0);
    if (!this.data.nextPrinterId || this.data.nextPrinterId <= maxPrinterId) {
      this.data.nextPrinterId = maxPrinterId + 1;
    }
    if (!this.data.nextEventId || this.data.nextEventId <= maxEventId) {
      this.data.nextEventId = maxEventId + 1;
    }
  }

  private save(): void {
    writeStoreFileAtomic(this.filePath, this.data);
    this.lastReadMtime = mtimeOf(this.filePath);
  }

  // ── Printers ──────────────────────────────────────────────

  getPrinters(): PrinterRecord[] {
    this.refreshIfStale();
    return [...this.data.printers].sort((a, b) => a.name.localeCompare(b.name));
  }

  addPrinter(input: { name: string; model: string; inkType: string; maxIdleDays: number; warningDays: number; autoMaintain?: boolean }): PrinterRecord {
    const now = new Date().toISOString();
    const printer: PrinterRecord = {
      id: this.data.nextPrinterId++,
      name: input.name,
      model: input.model,
      inkType: input.inkType,
      maxIdleDays: input.maxIdleDays,
      warningDays: input.warningDays,
      autoMaintain: input.autoMaintain ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.data.printers.push(printer);
    this.save();
    // Create initial maintenance event so the countdown starts now
    this.addEvent({ printerId: printer.id, eventType: 'print', notes: 'Initial setup – timer started' });
    return printer;
  }

  updatePrinter(id: number, input: Partial<{ name: string; model: string; inkType: string; maxIdleDays: number; warningDays: number; autoMaintain: boolean }>): PrinterRecord | null {
    const printer = this.data.printers.find(p => p.id === id);
    if (!printer) return null;

    if (input.name !== undefined) printer.name = input.name;
    if (input.model !== undefined) printer.model = input.model;
    if (input.inkType !== undefined) printer.inkType = input.inkType;
    if (input.maxIdleDays !== undefined) printer.maxIdleDays = input.maxIdleDays;
    if (input.warningDays !== undefined) printer.warningDays = input.warningDays;
    if (input.autoMaintain !== undefined) printer.autoMaintain = input.autoMaintain;
    printer.updatedAt = new Date().toISOString();

    this.save();
    return printer;
  }

  deletePrinter(id: number): void {
    this.data.printers = this.data.printers.filter(p => p.id !== id);
    this.data.events = this.data.events.filter(e => e.printerId !== id);
    this.save();
  }

  // ── Events ────────────────────────────────────────────────

  getEvents(printerId: number): EventRecord[] {
    this.refreshIfStale();
    return this.data.events
      .filter(e => e.printerId === printerId)
      .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
  }

  addEvent(input: { printerId: number; eventType: string; notes?: string }): EventRecord {
    const event: EventRecord = {
      id: this.data.nextEventId++,
      printerId: input.printerId,
      eventType: input.eventType as 'print' | 'clean',
      eventDate: new Date().toISOString(),
      notes: input.notes || '',
    };
    this.data.events.push(event);
    this.save();
    return event;
  }

  getLastEvent(printerId: number): EventRecord | null {
    const events = this.getEvents(printerId);
    return events.length > 0 ? events[0] : null;
  }

  getAllEvents(): (EventRecord & { printerName: string })[] {
    this.refreshIfStale();
    const printerMap = new Map(this.data.printers.map(p => [p.id, p.name]));
    return [...this.data.events]
      .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
      .map(e => ({ ...e, printerName: printerMap.get(e.printerId) || 'Unknown' }));
  }

  deleteEvent(eventId: number): void {
    this.data.events = this.data.events.filter(e => e.id !== eventId);
    this.save();
  }

  // ── Status ────────────────────────────────────────────────

  getPrintersWithStatus() {
    this.refreshIfStale();
    return this.getPrinters().map(printer => {
      const lastEvent = this.getLastEvent(printer.id);
      const { daysRemaining, status } = calculateStatus(lastEvent, printer.maxIdleDays, printer.warningDays);
      return { ...printer, lastEvent, daysRemaining, status };
    });
  }

  // ── Settings ───────────────────────────────────────────────

  getSettings(): AppSettings {
    if (!this.data.settings) {
      this.data.settings = {
        autoMaintenancePrint: false,
        theme: 'dark',
        maintenanceWindow: { startHour: 0, endHour: 24 },
        tickIntervalSeconds: 6 * 60 * 60,
      };
    }
    return { ...this.data.settings };
  }

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    if (!this.data.settings) {
      this.data.settings = {
        autoMaintenancePrint: false,
        theme: 'dark',
        maintenanceWindow: { startHour: 0, endHour: 24 },
        tickIntervalSeconds: 6 * 60 * 60,
      };
    }
    Object.assign(this.data.settings, partial);
    this.save();
    return { ...this.data.settings };
  }

  // ── Statistics ─────────────────────────────────────────────

  getStatistics() {
    const printers = this.getPrinters();
    const events = this.data.events;

    // Events per printer
    const perPrinter = printers.map(p => {
      const pEvents = events.filter(e => e.printerId === p.id);
      return {
        printerId: p.id,
        printerName: p.name,
        totalEvents: pEvents.length,
        prints: pEvents.filter(e => e.eventType === 'print').length,
        cleans: pEvents.filter(e => e.eventType === 'clean').length,
      };
    });

    // Events per day (last 30 days)
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const dailyMap = new Map<string, { prints: number; cleans: number }>();
    for (let d = 0; d < 30; d++) {
      const date = new Date(now - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      dailyMap.set(date, { prints: 0, cleans: 0 });
    }
    for (const e of events) {
      const ts = new Date(e.eventDate).getTime();
      if (ts >= thirtyDaysAgo) {
        const date = new Date(e.eventDate).toISOString().slice(0, 10);
        const entry = dailyMap.get(date);
        if (entry) {
          if (e.eventType === 'print') entry.prints++;
          else entry.cleans++;
        }
      }
    }
    const daily = Array.from(dailyMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalPrinters: printers.length,
      totalEvents: events.length,
      perPrinter,
      daily,
    };
  }

  // ── Print Monitor ─────────────────────────────────────────

  getLastPrintCheckTime(): string {
    return this.data.lastPrintCheckTime || new Date().toISOString();
  }

  setLastPrintCheckTime(iso: string): void {
    this.data.lastPrintCheckTime = iso;
    this.save();
  }

  // ── GUI session bookkeeping (for tick summary on launch) ────

  getLastGuiStartAt(): string | undefined {
    return this.data.lastGuiStartAt;
  }

  setLastGuiStartAt(iso: string): void {
    this.data.lastGuiStartAt = iso;
    this.save();
  }

  // ── Backup / Restore ──────────────────────────────────────

  exportData(): string {
    return JSON.stringify(this.data, null, 2);
  }

  importData(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed.printers) || !Array.isArray(parsed.events)) {
        warn('store', 'importData rejected: top-level shape invalid');
        return false;
      }
      this.data = parsed;
      this.migrate();
      this.save();
      return true;
    } catch (err) {
      error('store', 'importData failed', err);
      return false;
    }
  }
}

let store: Store;

export function initStore(): void {
  store = new Store();
}

export function getStore(): Store {
  return store;
}
