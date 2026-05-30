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

/**
 * Whether real-time auto-detection of print jobs is operational on
 * this OS right now. On Windows this requires the
 * Microsoft-Windows-PrintService/Operational log to be enabled. On
 * macOS/Linux CUPS' page_log is always available.
 */
export interface DetectionStatus {
  /** True if the app can currently observe print jobs automatically. */
  available: boolean;
  /** Human-readable explanation of the current state. */
  reason: string;
  /** True if the user (or app) can fix this without external tools. */
  fixable: boolean;
  /** Short hint shown next to the "Enable" button in the UI. */
  actionHint?: string;
}

export interface DetectionFixResult {
  success: boolean;
  reason?: string;
}

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

  /** Inspect whether auto-detection prerequisites are satisfied. */
  checkDetectionStatus(): Promise<DetectionStatus>;

  /**
   * Attempt to fix the prerequisites flagged by checkDetectionStatus.
   * On Windows, runs wevtutil to enable the print log (may trigger UAC).
   */
  attemptFixDetection(): Promise<DetectionFixResult>;
}
