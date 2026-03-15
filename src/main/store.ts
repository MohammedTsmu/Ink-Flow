import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface PrinterRecord {
  id: number;
  name: string;
  model: string;
  inkType: string;
  maxIdleDays: number;
  warningDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventRecord {
  id: number;
  printerId: number;
  eventType: 'print' | 'clean';
  eventDate: string;
  notes: string;
}

export interface AppSettings {
  autoMaintenancePrint: boolean;
  theme: 'dark' | 'light';
}

interface StoreData {
  printers: PrinterRecord[];
  events: EventRecord[];
  nextPrinterId: number;
  nextEventId: number;
  settings: AppSettings;
  lastPrintCheckTime: string;
}

class Store {
  private data!: StoreData;
  private filePath: string;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'inkflow-data.json');
    this.load();
  }

  private load(): void {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      this.data = JSON.parse(raw);
      this.migrate();
    } catch {
      this.data = {
        printers: [], events: [], nextPrinterId: 1, nextEventId: 1,
        settings: { autoMaintenancePrint: false, theme: 'dark' },
        lastPrintCheckTime: new Date().toISOString(),
      };
      this.save();
    }
  }

  /** Ensure all fields exist for data created by older versions. */
  private migrate(): void {
    if (!this.data.settings) {
      this.data.settings = { autoMaintenancePrint: false, theme: 'dark' };
    }
    if (!this.data.lastPrintCheckTime) {
      this.data.lastPrintCheckTime = new Date().toISOString();
    }
    if (!Array.isArray(this.data.printers)) this.data.printers = [];
    if (!Array.isArray(this.data.events)) this.data.events = [];
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
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Atomic write: write to temp file then rename to prevent corruption
    const tmpPath = this.filePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
  }

  // ── Printers ──────────────────────────────────────────────

  getPrinters(): PrinterRecord[] {
    return [...this.data.printers].sort((a, b) => a.name.localeCompare(b.name));
  }

  addPrinter(input: { name: string; model: string; inkType: string; maxIdleDays: number; warningDays: number }): PrinterRecord {
    const now = new Date().toISOString();
    const printer: PrinterRecord = {
      id: this.data.nextPrinterId++,
      name: input.name,
      model: input.model,
      inkType: input.inkType,
      maxIdleDays: input.maxIdleDays,
      warningDays: input.warningDays,
      createdAt: now,
      updatedAt: now,
    };
    this.data.printers.push(printer);
    this.save();
    // Create initial maintenance event so the countdown starts now
    this.addEvent({ printerId: printer.id, eventType: 'clean', notes: 'Initial setup – timer started' });
    return printer;
  }

  updatePrinter(id: number, input: Partial<{ name: string; model: string; inkType: string; maxIdleDays: number; warningDays: number }>): PrinterRecord | null {
    const printer = this.data.printers.find(p => p.id === id);
    if (!printer) return null;

    if (input.name !== undefined) printer.name = input.name;
    if (input.model !== undefined) printer.model = input.model;
    if (input.inkType !== undefined) printer.inkType = input.inkType;
    if (input.maxIdleDays !== undefined) printer.maxIdleDays = input.maxIdleDays;
    if (input.warningDays !== undefined) printer.warningDays = input.warningDays;
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
    return this.getPrinters().map(printer => {
      const lastEvent = this.getLastEvent(printer.id);
      const { daysRemaining, status } = this.calculateStatus(lastEvent, printer.maxIdleDays, printer.warningDays);
      return { ...printer, lastEvent, daysRemaining, status };
    });
  }

  private calculateStatus(lastEvent: EventRecord | null, maxIdleDays: number, warningDays: number) {
    if (!lastEvent) {
      return { daysRemaining: 0, status: 'overdue' as const };
    }

    const diffMs = Date.now() - new Date(lastEvent.eventDate).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    const remaining = Math.round((maxIdleDays - diffDays) * 10) / 10;

    let status: 'good' | 'warning' | 'urgent' | 'overdue';
    if (remaining <= 0) status = 'overdue';
    else if (remaining <= 1) status = 'urgent';
    else if (remaining <= warningDays) status = 'warning';
    else status = 'good';

    return { daysRemaining: remaining, status };
  }

  // ── Settings ───────────────────────────────────────────────

  getSettings(): AppSettings {
    if (!this.data.settings) {
      this.data.settings = { autoMaintenancePrint: false, theme: 'dark' };
    }
    return { ...this.data.settings };
  }

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    if (!this.data.settings) {
      this.data.settings = { autoMaintenancePrint: false, theme: 'dark' };
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

  // ── Test Helpers ───────────────────────────────────────────

  simulateOverdue(printerId: number, daysAgo: number): boolean {
    const events = this.data.events.filter(e => e.printerId === printerId);
    if (events.length === 0) return false;
    // Backdate the most recent event for this printer
    const sorted = events.sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
    const pastDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    sorted[0].eventDate = pastDate;
    this.save();
    return true;
  }

  // ── Print Monitor ─────────────────────────────────────────

  getLastPrintCheckTime(): string {
    return this.data.lastPrintCheckTime || new Date().toISOString();
  }

  setLastPrintCheckTime(iso: string): void {
    this.data.lastPrintCheckTime = iso;
    this.save();
  }

  // ── Backup / Restore ──────────────────────────────────────

  exportData(): string {
    return JSON.stringify(this.data, null, 2);
  }

  importData(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed.printers) || !Array.isArray(parsed.events)) return false;
      this.data = parsed;
      this.migrate();
      this.save();
      return true;
    } catch {
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
