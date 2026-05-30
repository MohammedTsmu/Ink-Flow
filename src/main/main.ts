import { app, BrowserWindow, Tray } from 'electron';
import path from 'path';
import { initStore } from './store';
import { setupIpcHandlers } from './ipc-handlers';
import { createTray } from './tray';
import { startNotificationScheduler, stopNotificationScheduler } from './notifications';
import { startPrintMonitor, stopPrintMonitor } from './print-monitor';
import { setMainWindow } from './window-ref';
import { initLogger, info, error, warn } from '../core/log';
import { getAdapter } from '../core/printers';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Ink Flow',
    icon: path.join(__dirname, '../../assets/icon.png'),
    backgroundColor: '#030712',
    show: false,
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  const startHidden = process.argv.includes('--hidden');
  mainWindow.once('ready-to-show', () => {
    if (!startHidden) {
      mainWindow?.show();
    }
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

if (process.platform === 'win32') {
  app.setAppUserModelId('com.inkflow.app');
}

app.on('before-quit', () => {
  isQuitting = true;
  stopPrintMonitor();
  stopNotificationScheduler();
  info('app', 'Shutting down');
});

process.on('uncaughtException', (err) => {
  error('app', 'uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
  error('app', 'unhandledRejection', reason);
});

app.whenReady().then(async () => {
  initLogger(app.getPath('userData'));
  info('app', 'Starting Ink Flow', { version: app.getVersion(), platform: process.platform });
  initStore();
  setupIpcHandlers();
  createWindow();
  setMainWindow(mainWindow!);
  tray = createTray(mainWindow!);
  startNotificationScheduler();
  startPrintMonitor();

  // Verify auto-detection prerequisites — surfaces the "log disabled"
  // issue immediately instead of silently failing for weeks.
  try {
    const status = await getAdapter().checkDetectionStatus();
    if (status.available) {
      info('app', 'Auto-detection prereqs OK', status);
    } else {
      warn('app', 'Auto-detection prereqs failed', status);
    }
  } catch (err) {
    error('app', 'Could not check detection status', err);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
