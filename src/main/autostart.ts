import { app } from 'electron';

const APP_NAME = 'InkFlow';

/**
 * Cross-platform autostart via Electron's built-in login items API.
 *
 *  - Windows  → HKCU\Software\Microsoft\Windows\CurrentVersion\Run
 *  - macOS    → ServiceManagement (Login Items in System Settings)
 *  - Linux    → ~/.config/autostart/InkFlow.desktop
 *
 * Replaces the previous VBS + cscript implementation, which only
 * worked on Windows and tripped antivirus heuristics for "script
 * writing a .vbs file and executing it".
 */

export function isAutoStartEnabled(): boolean {
  const settings = app.getLoginItemSettings();
  return settings.openAtLogin;
}

export function setAutoStart(enabled: boolean): void {
  if (enabled) {
    app.setLoginItemSettings({
      openAtLogin: true,
      // macOS only: hide the app on auto-launch so it goes straight to the tray.
      openAsHidden: process.platform === 'darwin',
      args: ['--hidden'],
      name: APP_NAME,
    });
  } else {
    app.setLoginItemSettings({
      openAtLogin: false,
      name: APP_NAME,
    });
  }
}
