import { getAdapter, SystemPrinter, ConnectivityStatus } from '../core/printers';

export type { SystemPrinter, ConnectivityStatus };

export function detectSystemPrinters(): Promise<SystemPrinter[]> {
  return getAdapter().listSystem();
}

export function checkPrinterStatus(name: string): Promise<ConnectivityStatus> {
  return getAdapter().getStatus(name);
}
