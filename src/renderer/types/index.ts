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
    };
  }
}

export {};
