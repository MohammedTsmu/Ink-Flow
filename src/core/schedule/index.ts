import { ScheduleProvider } from './types';
import { WindowsScheduleProvider } from './windows';
import { MacosScheduleProvider } from './macos';
import { LinuxScheduleProvider } from './linux';

export * from './types';

let cached: ScheduleProvider | null = null;

export function getScheduleProvider(): ScheduleProvider {
  if (cached) return cached;
  switch (process.platform) {
    case 'win32': cached = new WindowsScheduleProvider(); break;
    case 'darwin': cached = new MacosScheduleProvider(); break;
    default: cached = new LinuxScheduleProvider(); break;
  }
  return cached;
}

export const TICK_LABEL = 'InkFlowTick';
export const TICK_INTERVAL_SECONDS = 6 * 60 * 60; // 6 hours
