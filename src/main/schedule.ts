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
  return {
    label: TICK_LABEL,
    executable: process.execPath,
    args: [getTickScriptPath(), `--user-data=${app.getPath('userData')}`],
    env: { ELECTRON_RUN_AS_NODE: '1' },
    intervalSeconds: TICK_INTERVAL_SECONDS,
  };
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
