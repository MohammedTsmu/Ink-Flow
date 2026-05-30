import path from 'path';
import os from 'os';

/**
 * Mirrors Electron's app.getPath('userData') so the headless
 * maintenance tick (which never instantiates Electron) and the main
 * process agree on where inkflow-data.json lives.
 *
 *   Windows : %APPDATA%/<name>
 *   macOS   : ~/Library/Application Support/<name>
 *   Linux   : $XDG_CONFIG_HOME/<name>  or  ~/.config/<name>
 *
 * The OS scheduler entry for the tick passes the resolved path via
 * --user-data=... so even if Electron's productName-based default
 * differs from our default here, the tick still hits the right file.
 */

export const APP_DIR_NAME = 'Ink Flow';

export function getUserDataPath(appName: string = APP_DIR_NAME): string {
  switch (process.platform) {
    case 'win32': {
      const appdata = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      return path.join(appdata, appName);
    }
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', appName);
    default: {
      const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
      return path.join(xdg, appName);
    }
  }
}

/**
 * Resolve user data path from a --user-data=PATH command-line argument,
 * falling back to the platform default. Used by headless entry points.
 */
export function resolveUserDataFromArgv(argv: string[] = process.argv): string {
  const cliArg = argv.find(a => a.startsWith('--user-data='));
  if (cliArg) {
    const value = cliArg.slice('--user-data='.length);
    if (value) return value;
  }
  return getUserDataPath();
}
