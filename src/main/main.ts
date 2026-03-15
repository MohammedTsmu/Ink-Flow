import { app, BrowserWindow } from 'electron';
import path from 'path';
import { initStore } from './store';
import { setupIpcHandlers } from './ipc-handlers';
import { createTray } from './tray';
import { startNotificationScheduler } from './notifications';
import { startPrintMonitor, stopPrintMonitor } from './print-monitor';

let mainWindow: BrowserWindow | null = null;
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

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

app.setAppUserModelId('com.inkflow.app');

app.on('before-quit', () => {
  isQuitting = true;
  stopPrintMonitor();
});

app.whenReady().then(() => {
  initStore();
  setupIpcHandlers();
  createWindow();
  createTray(mainWindow!);
  startNotificationScheduler();
  startPrintMonitor();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
