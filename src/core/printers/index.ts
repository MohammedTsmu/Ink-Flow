import { PrinterAdapter } from './types';
import { WindowsAdapter } from './windows';
import { CupsAdapter } from './cups';

export * from './types';

let cached: PrinterAdapter | null = null;

/**
 * Get the printer adapter for the current platform. Cached after first
 * call.
 */
export function getAdapter(): PrinterAdapter {
  if (cached) return cached;
  switch (process.platform) {
    case 'win32':
      cached = new WindowsAdapter();
      break;
    case 'darwin':
      cached = new CupsAdapter('darwin');
      break;
    case 'linux':
      cached = new CupsAdapter('linux');
      break;
    default:
      throw new Error(`Ink Flow does not support platform "${process.platform}".`);
  }
  return cached;
}
