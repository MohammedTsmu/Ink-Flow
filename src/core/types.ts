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
  /**
   * When false, the headless tick and auto-print never target this
   * printer even if it is overdue. Default: true. Useful for expensive
   * printers (large-format, photo) that the user wants to run manually.
   */
  autoMaintain: boolean;
  /**
   * Last time the user was alerted about this printer (any non-good
   * status). Used to throttle popups so a printer that stays "overdue"
   * for two weeks doesn't fire 336 popups.
   */
  lastAlertedAt?: string;
  /** Level at which we last alerted — escalation always re-notifies. */
  lastAlertedLevel?: string;
  /** Last native-notification fired by auto-print for this printer. */
  lastAutoPrintNotifiedAt?: string;
}

export interface EventRecord {
  id: number;
  printerId: number;
  eventType: EventType;
  eventDate: string;
  notes: string;
}

export interface MaintenanceWindow {
  /** Local hour at which auto-maintenance becomes eligible (0-23). */
  startHour: number;
  /**
   * Local hour at which auto-maintenance stops (0-24). Use { 0, 24 }
   * to mean "always allowed". A window where startHour > endHour
   * wraps over midnight (e.g. { 22, 6 } = 10 PM through 6 AM).
   */
  endHour: number;
}

export interface AppSettings {
  autoMaintenancePrint: boolean;
  theme: 'dark' | 'light';
  /** Time-of-day window during which auto-prints may fire. */
  maintenanceWindow: MaintenanceWindow;
  /** How often the headless background tick fires, in seconds. */
  tickIntervalSeconds: number;
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
  /** ISO timestamp of the most recent GUI session start. */
  lastGuiStartAt?: string;
  /**
   * ISO timestamp when the user finished (or explicitly skipped) the
   * first-run wizard. Undefined means the wizard hasn't been seen yet
   * and should be presented on next launch.
   */
  firstRunCompletedAt?: string;
}

export interface TickSummary {
  /** Window over which the summary is taken. */
  since: string;
  ticksRan: number;
  prints: number;
  offlineSkips: number;
  failures: number;
  /** Printer names that received auto-prints, deduped. */
  printersServed: string[];
}
