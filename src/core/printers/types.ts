/**
 * Platform-agnostic printer interface. Each OS (Windows, macOS, Linux)
 * implements this with its native print subsystem (Win32 spooler / CUPS).
 *
 * The adapter is intentionally narrow: it provides primitives. Higher-level
 * orchestration (auto-maintenance, dedup, store writes) lives elsewhere.
 */

export interface SystemPrinter {
  name: string;
  portName?: string;
  driverName?: string;
  shared?: boolean;
}

export interface PrintEvent {
  /** ISO-8601 timestamp the OS recorded for the event. */
  timeCreated: string;
  printerName: string;
  documentName: string;
}

export type ConnectivityStatus = 'online' | 'offline' | 'unknown';

export type SupportedPlatform = 'win32' | 'darwin' | 'linux';

export interface PrinterAdapter {
  readonly platform: SupportedPlatform;

  /** Enumerate printers installed on the OS. */
  listSystem(): Promise<SystemPrinter[]>;

  /** Check connectivity of a single printer by its OS-native name. */
  getStatus(name: string): Promise<ConnectivityStatus>;

  /**
   * Send a maintenance test page. Resolves true on success, false on
   * failure. Implementations must avoid AV-flagged patterns where
   * possible.
   */
  sendTestPrint(name: string): Promise<boolean>;

  /**
   * Subscribe to print events. The callback fires once per detected
   * print job. Returns an unsubscribe function that releases all
   * underlying resources (timers, watchers, subscriptions).
   */
  subscribeToPrintEvents(callback: (event: PrintEvent) => void): () => void;
}
