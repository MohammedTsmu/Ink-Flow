/**
 * Shared domain types used by both the Electron main process and the
 * headless maintenance tick. Lives in src/core/ so neither process has
 * to depend on the other.
 */

export type EventType = 'print' | 'clean';

export type PrinterStatus = 'good' | 'warning' | 'urgent' | 'overdue';

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
  eventType: EventType;
  eventDate: string;
  notes: string;
}

export interface AppSettings {
  autoMaintenancePrint: boolean;
  theme: 'dark' | 'light';
}

export interface PrinterWithStatus extends PrinterRecord {
  lastEvent: EventRecord | null;
  daysRemaining: number;
  status: PrinterStatus;
}

export interface StoreData {
  printers: PrinterRecord[];
  events: EventRecord[];
  nextPrinterId: number;
  nextEventId: number;
  settings: AppSettings;
  lastPrintCheckTime: string;
}
