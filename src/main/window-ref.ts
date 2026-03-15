import { BrowserWindow } from 'electron';

/** Shared reference to the main window — avoids circular imports. */
let mainWindow: BrowserWindow | null = null;

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
