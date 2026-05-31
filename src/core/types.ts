/**
 * Shared domain types used by both the Electron main process and the
 * headless maintenance tick. Lives in src/core/ so neither process has
 * to depend on the other.
 */

export type EventType = 'print' | 'clean';

/**
 * Origin/intent of an event. 'maintenance' events are color test pages we
 * generated and know exercise every ink channel. 'user' events are real
 * prints from external apps (or manual clicks) where we cannot know which
 * channels actually fired. 'clean' = manual head-clean cycle.
 *
 * Optional + backward-compatible — events created before this field
 * existed are migrated based on notes.
 */
export type EventCategory = 'maintenance' | 'user' | 'clean';

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
   * When true (the default), auto-detected prints from external apps
   * reset the maintenance countdown for this printer — same as v3.1 and
   * earlier. When false, only events we KNOW exercise every ink channel
   * (color test pages and manual cleans) reset the countdown; external
   * prints are still logged but treated as "we don't know which colors
   * fired". Turn off for printers used mostly for black-and-white text —
   * that way the color maintenance schedule still runs even if you
   * print frequently.
   */
  trustUserPrints?: boolean;
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
  /**
   * What kind of event this is. Maintenance events are our color test
   * pages (known to fire every nozzle). User events are external prints
   * (we cannot know which channels fired). Clean events are manual head
   * cleaning. Optional for migration; populated from notes when absent.
   */
  category?: EventCategory;
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
