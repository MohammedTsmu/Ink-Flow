import { PrinterAdapter } from './types';
import { WindowsAdapter } from './windows';

export * from './types';

let cached: PrinterAdapter | null = null;

/**
 * Get the printer adapter for the current platform. Cached after first
 * call. The CUPS adapter for macOS/Linux is added in Phase 3.1.
 */
export function getAdapter(): PrinterAdapter {
  if (cached) return cached;
  if (process.platform === 'win32') {
    cached = new WindowsAdapter();
    return cached;
  }
  throw new Error(
    `Ink Flow does not yet support platform "${process.platform}". ` +
    'CUPS support for macOS and Linux ships in v3.0.',
  );
}
