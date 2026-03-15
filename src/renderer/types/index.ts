export interface PrinterData {
  name: string;
  model: string;
  inkType: string;
  maxIdleDays: number;
  warningDays: number;
}

export interface Printer extends PrinterData {
  id: number;
  createdAt: string;
  updatedAt: string;
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

export interface AppSettings {
  autoMaintenancePrint: boolean;
  theme: 'dark' | 'light';
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

declare global {
  interface Window {
    api: {
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
      // Alert listener
      onPrinterAlerts: (callback: (alerts: AlertItem[]) => void) => () => void;
    };
  }
}

export {};
