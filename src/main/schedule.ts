import { app } from 'electron';
import path from 'path';
import {
  getScheduleProvider,
  TICK_LABEL,
  TICK_INTERVAL_SECONDS,
  ScheduleConfig,
  ScheduleResult,
  ScheduleStatus,
} from '../core/schedule';
import { getStore } from './store';

/**
 * Glue between the OS-agnostic ScheduleProvider and Electron's
 * filesystem layout. Resolves the right path to the tick script for
 * both dev (unpackaged) and production (asarUnpack) runs.
 */

function getTickScriptPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'tick', 'index.js');
  }
  return path.join(app.getAppPath(), 'dist', 'tick', 'index.js');
}

function buildConfig(): ScheduleConfig {
  const settings = getStore().getSettings();
  const interval = settings.tickIntervalSeconds && settings.tickIntervalSeconds >= 60
    ? settings.tickIntervalSeconds
    : TICK_INTERVAL_SECONDS;
  return {
    label: TICK_LABEL,
    executable: process.execPath,
    args: [getTickScriptPath(), `--user-data=${app.getPath('userData')}`],
    env: { ELECTRON_RUN_AS_NODE: '1' },
    intervalSeconds: interval,
  };
}

/**
 * If the schedule is currently installed, re-install it with the
 * current settings (typically called after the user changes
 * tickIntervalSeconds in Settings).
 */
export async function refreshScheduleIfInstalled(): Promise<void> {
  const status = await getScheduleProvider().status(TICK_LABEL);
  if (!status.installed) return;
  await getScheduleProvider().install(buildConfig());
}

export function getScheduleStatus(): Promise<ScheduleStatus> {
  return getScheduleProvider().status(TICK_LABEL);
}

export function installSchedule(): Promise<ScheduleResult> {
  return getScheduleProvider().install(buildConfig());
}

export function uninstallSchedule(): Promise<ScheduleResult> {
  return getScheduleProvider().uninstall(TICK_LABEL);
}
