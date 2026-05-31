import { app } from 'electron';
import { execFile } from 'child_process';
import { info, warn, error } from '../core/log';

const APP_NAME = 'InkFlow';
const REG_RUN_KEY = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

/**
 * Cross-platform autostart.
 *
 *  - Windows : direct HKCU\...\Run registry writes with proper quoting.
 *              We bypass app.setLoginItemSettings({args}) because it
 *              writes the exe path WITHOUT surrounding quotes — so a path
 *              like "C:\Program Files\Ink Flow\Ink Flow.exe --hidden"
 *              gets parsed back as exe="C:\Program" args="Files\Ink ...".
 *              getLoginItemSettings then reports openAtLogin=false even
 *              though the entry exists. Writing the value ourselves with
 *              the exe in double-quotes fixes the round-trip.
 *  - macOS    : ServiceManagement (Login Items in System Settings)
 *  - Linux    : ~/.config/autostart/InkFlow.desktop
 */

export function isAutoStartEnabled(): boolean {
  if (process.platform !== 'win32') {
    return app.getLoginItemSettings().openAtLogin;
  }
  // Synchronous Electron-level check first — it's correct *if* the value
  // was written properly. We still write via our own path, so this is the
  // belt-and-braces read.
  return app.getLoginItemSettings({
    path: process.execPath,
    args: ['--hidden'],
  }).openAtLogin;
}

export function setAutoStart(enabled: boolean): void {
  if (process.platform !== 'win32') {
    macLinuxSetAutoStart(enabled);
    return;
  }

  if (enabled) {
    const value = `"${process.execPath}" --hidden`;
    runRegistryUpdate(`Set-ItemProperty -Path '${REG_RUN_KEY}' -Name '${APP_NAME}' -Value '${escapePsSingle(value)}' -Type String`)
      .then(() => info('autostart', 'Wrote HKCU Run entry', { name: APP_NAME, value }))
      .catch(err => error('autostart', 'Could not write HKCU Run entry', err));
  } else {
    runRegistryUpdate(`Remove-ItemProperty -Path '${REG_RUN_KEY}' -Name '${APP_NAME}' -ErrorAction SilentlyContinue`)
      .then(() => info('autostart', 'Removed HKCU Run entry', { name: APP_NAME }))
      .catch(err => warn('autostart', 'Could not remove HKCU Run entry', err));
  }
}

function macLinuxSetAutoStart(enabled: boolean): void {
  if (enabled) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: process.platform === 'darwin',
      args: ['--hidden'],
      name: APP_NAME,
    });
    info('autostart', 'setLoginItemSettings: openAtLogin=true');
  } else {
    app.setLoginItemSettings({ openAtLogin: false, name: APP_NAME });
    info('autostart', 'setLoginItemSettings: openAtLogin=false');
  }
}

function runRegistryUpdate(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 10_000 },
      (err) => err ? reject(err) : resolve(),
    );
  });
}

function escapePsSingle(s: string): string {
  return s.replace(/'/g, "''");
}
