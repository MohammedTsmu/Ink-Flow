import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const APP_NAME = 'InkFlow';

function getStartupShortcutPath(): string {
  const startupDir = path.join(
    process.env.APPDATA || '',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup',
  );
  return path.join(startupDir, `${APP_NAME}.lnk`);
}

export function isAutoStartEnabled(): boolean {
  // In packaged app, check for startup shortcut
  if (app.isPackaged) {
    return fs.existsSync(getStartupShortcutPath());
  }
  // In dev, use Electron's login items API
  const settings = app.getLoginItemSettings();
  return settings.openAtLogin;
}

export function setAutoStart(enabled: boolean): void {
  if (app.isPackaged) {
    const shortcutPath = getStartupShortcutPath();
    if (enabled) {
      // Create shortcut using Electron's shell
      const exePath = process.execPath;
      const { shell } = require('electron');
      // Use Windows Script Host to create shortcut
      const wsScript = `
        Set WshShell = CreateObject("WScript.Shell")
        Set shortcut = WshShell.CreateShortcut("${shortcutPath.replace(/\\/g, '\\\\')}")
        shortcut.TargetPath = "${exePath.replace(/\\/g, '\\\\')}"
        shortcut.Arguments = "--hidden"
        shortcut.WorkingDirectory = "${path.dirname(exePath).replace(/\\/g, '\\\\')}"
        shortcut.Description = "Ink Flow - Printer Maintenance Tracker"
        shortcut.Save
      `;
      const tempVbs = path.join(app.getPath('temp'), 'inkflow-startup.vbs');
      fs.writeFileSync(tempVbs, wsScript, 'utf-8');
      require('child_process').execSync(`cscript //nologo "${tempVbs}"`, { timeout: 5000 });
      try { fs.unlinkSync(tempVbs); } catch {}
    } else {
      try { fs.unlinkSync(shortcutPath); } catch {}
    }
  } else {
    app.setLoginItemSettings({ openAtLogin: enabled });
  }
}
