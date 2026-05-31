export interface PrinterData {
  name: string;
  model: string;
  inkType: string;
  maxIdleDays: number;
  warningDays: number;
  autoMaintain?: boolean;
  trustUserPrints?: boolean;
}

export interface Printer extends PrinterData {
  id: number;
  createdAt: string;
  updatedAt: string;
  autoMaintain: boolean;
  trustUserPrints: boolean;
}

export interface MaintenanceEvent {
  id: number;
  printerId: number;
  eventType: 'print' | 'clean';
  eventDate: string;
  notes: string;
}

export interface PrinterWithStatus extends Printer {
  lastEvent: MaintenanceEvent | null;
  daysRemaining: number;
  status: 'good' | 'warning' | 'urgent' | 'overdue';
}

export interface SystemPrinter {
  name: string;
  portName: string;
  driverName: string;
  shared: boolean;
}

export interface MaintenanceEventWithPrinter extends MaintenanceEvent {
  printerName: string;
}

export interface MaintenanceWindow {
  startHour: number;
  endHour: number;
}

export interface AppSettings {
  autoMaintenancePrint: boolean;
  theme: 'dark' | 'light';
  maintenanceWindow: MaintenanceWindow;
  tickIntervalSeconds: number;
}

export interface PrinterStats {
  printerId: number;
  printerName: string;
  totalEvents: number;
  prints: number;
  cleans: number;
}

export interface DailyStats {
  date: string;
  prints: number;
  cleans: number;
}

export interface Statistics {
  totalPrinters: number;
  totalEvents: number;
  perPrinter: PrinterStats[];
  daily: DailyStats[];
}

export interface AlertItem {
  name: string;
  status: string;
  level: string;
  message: string;
}

export interface DiagnosticEntry {
  ts: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  detail?: unknown;
}

export interface DetectionStatus {
  available: boolean;
  reason: string;
  fixable: boolean;
  actionHint?: string;
}

export interface DetectionFixResult {
  success: boolean;
  reason?: string;
}

export interface ScheduleResult {
  success: boolean;
  reason?: string;
}

export interface ScheduleStatus {
  installed: boolean;
  detail?: string;
  lastRunAt?: string;
}

export interface TickSummary {
  since: string;
  ticksRan: number;
  prints: number;
  offlineSkips: number;
  failures: number;
  printersServed: string[];
}

export interface TickStats {
  ticksRan: number;
  prints: number;
  offlineSkips: number;
  failures: number;
  uniquePrintersServed: number;
}

export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'not-available'; lastChecked: string }
  | { status: 'available'; version: string }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string };

declare global {
  interface Window {
    api: {
      getAppVersion: () => Promise<string>;
      getPrinters: () => Promise<Printer[]>;
      addPrinter: (printer: PrinterData) => Promise<Printer>;
      updatePrinter: (id: number, printer: Partial<PrinterData>) => Promise<Printer>;
      deletePrinter: (id: number) => Promise<void>;
      getEvents: (printerId: number) => Promise<MaintenanceEvent[]>;
      addEvent: (event: { printerId: number; eventType: string; notes?: string }) => Promise<MaintenanceEvent>;
      getPrintersWithStatus: () => Promise<PrinterWithStatus[]>;
      // Phase 2
      detectSystemPrinters: () => Promise<SystemPrinter[]>;
      checkPrinterStatus: (printerName: string) => Promise<'online' | 'offline' | 'unknown'>;
      getAutoStart: () => Promise<boolean>;
      setAutoStart: (enabled: boolean) => Promise<void>;
      getAllEvents: () => Promise<MaintenanceEventWithPrinter[]>;
      deleteEvent: (eventId: number) => Promise<void>;
      // Phase 3
      getSettings: () => Promise<AppSettings>;
      updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>;
      getStatistics: () => Promise<Statistics>;
      sendTestPrint: (printerName: string, printerId: number) => Promise<{ success: boolean; reason: string | null }>;
      exportBackup: () => Promise<boolean>;
      importBackup: () => Promise<boolean>;
      // Phase 1.4: Diagnostics
      getDiagnostics: (limit?: number) => Promise<DiagnosticEntry[]>;
      // Phase 1.5: Auto-detection prereqs
      getDetectionStatus: () => Promise<DetectionStatus>;
      attemptFixDetection: () => Promise<DetectionFixResult>;
      // Phase 2.3: Background maintenance schedule
      getScheduleStatus: () => Promise<ScheduleStatus>;
      installSchedule: () => Promise<ScheduleResult>;
      uninstallSchedule: () => Promise<ScheduleResult>;
      // 3.0.11: tick summary on launch
      getTickSummary: () => Promise<TickSummary | null>;
      markSummarySeen: () => Promise<boolean>;
      // 3.0.12: aggregated tick stats
      getTickStats: () => Promise<TickStats>;
      // 3.0.15: auto-updater
      getUpdateState: () => Promise<UpdateState>;
      checkForUpdates: () => Promise<UpdateState>;
      quitAndInstallUpdate: () => Promise<boolean>;
      // 3.0.18: first-run wizard
      isFirstRunCompleted: () => Promise<boolean>;
      markFirstRunCompleted: () => Promise<boolean>;
      // Alert listener
      onPrinterAlerts: (callback: (alerts: AlertItem[]) => void) => () => void;
    };
  }
}

export {};
