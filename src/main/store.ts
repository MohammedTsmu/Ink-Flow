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

interface StoreData {
  printers: PrinterRecord[];
  events: EventRecord[];
  nextPrinterId: number;
  nextEventId: number;
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
    } catch {
      this.data = { printers: [], events: [], nextPrinterId: 1, nextEventId: 1 };
      this.save();
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
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

    return { daysRemaining: Math.max(0, remaining), status };
  }
}

let store: Store;

export function initStore(): void {
  store = new Store();
}

export function getStore(): Store {
  return store;
}
