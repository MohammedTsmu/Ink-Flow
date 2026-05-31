import { app, Notification } from 'electron';
import { autoUpdater } from 'electron-updater';
import { info, warn, error } from '../core/log';

/**
 * Auto-update glue. Uses electron-updater against the GitHub
 * Releases provider configured in package.json `build.publish`.
 *
 * Behavior:
 *  - On packaged-app startup, silently check for updates.
 *  - If an update is available, download it in the background.
 *  - When the download finishes, fire a native notification telling
 *    the user it will install on next launch (avoids interrupting work).
 *  - The Settings UI can also trigger a manual check via IPC.
 *
 * In dev (unpackaged), all of this is skipped — the updater has no
 * meaningful target.
 */

export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'not-available'; lastChecked: string }
  | { status: 'available'; version: string }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string };

let state: UpdateState = { status: 'idle' };
let initialised = false;

export function getUpdateState(): UpdateState {
  return state;
}

export function initAutoUpdater(): void {
  if (initialised) return;
  initialised = true;

  if (!app.isPackaged) {
    info('updater', 'Skipping auto-updater (running unpackaged)');
    return;
  }

  // electron-updater's internal logger funnels into our diagnostics.
  autoUpdater.logger = {
    info: (msg: unknown) => info('updater', String(msg)),
    warn: (msg: unknown) => warn('updater', String(msg)),
    error: (msg: unknown) => error('updater', String(msg)),
    debug: () => { /* drop */ },
  } as unknown as typeof autoUpdater.logger;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => { state = { status: 'checking' }; });
  autoUpdater.on('update-available', (i) => {
    state = { status: 'available', version: i.version };
    info('updater', 'Update available', { version: i.version });
  });
  autoUpdater.on('update-not-available', () => {
    state = { status: 'not-available', lastChecked: new Date().toISOString() };
  });
  autoUpdater.on('download-progress', (p) => {
    state = { status: 'downloading', version: state.status === 'available' || state.status === 'downloading' ? state.version : '?', percent: Math.round(p.percent) };
  });
  autoUpdater.on('update-downloaded', (i) => {
    state = { status: 'downloaded', version: i.version };
    info('updater', 'Update downloaded; will install on quit', { version: i.version });
    if (Notification.isSupported()) {
      new Notification({
        title: `Ink Flow ${i.version} ready to install`,
        body: 'The update will be applied automatically the next time you quit and reopen Ink Flow.',
      }).show();
    }
  });
  autoUpdater.on('error', (err) => {
    state = { status: 'error', message: err.message };
    error('updater', 'Auto-update error', err);
  });

  // Startup check, debounced slightly so it doesn't compete with init.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      error('updater', 'checkForUpdates threw', err);
    });
  }, 15_000);
}

export async function checkForUpdatesNow(): Promise<UpdateState> {
  if (!app.isPackaged) {
    return { status: 'error', message: 'Update checks are disabled in dev mode.' };
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    error('updater', 'Manual check failed', err);
    return { status: 'error', message: String(err) };
  }
  return getUpdateState();
}

export function quitAndInstallNow(): void {
  if (state.status !== 'downloaded') return;
  info('updater', 'Quitting to install update');
  // setImmediate so the IPC reply lands before we tear down. Pass
  // (isSilent=false, isForceRunAfter=true) — silent would skip the NSIS
  // wizard, but we configured oneClick:false so the user sees the install
  // step; forceRunAfter relaunches Ink Flow when the installer completes.
  setImmediate(() => {
    try {
      autoUpdater.quitAndInstall(false, true);
    } catch (err) {
      error('updater', 'quitAndInstall threw', err);
    }
  });
}
