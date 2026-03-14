import { ipcMain } from 'electron';
import { getStore } from './store';
import { detectSystemPrinters } from './printer-detect';
import { isAutoStartEnabled, setAutoStart } from './autostart';

export function setupIpcHandlers(): void {
  const store = getStore();

  ipcMain.handle('get-printers', () => store.getPrinters());

  ipcMain.handle('add-printer', (_e, input) => store.addPrinter(input));

  ipcMain.handle('update-printer', (_e, id, input) => store.updatePrinter(id, input));

  ipcMain.handle('delete-printer', (_e, id) => store.deletePrinter(id));

  ipcMain.handle('get-events', (_e, printerId) => store.getEvents(printerId));

  ipcMain.handle('add-event', (_e, input) => store.addEvent(input));

  ipcMain.handle('get-printers-with-status', () => store.getPrintersWithStatus());

  // Phase 2: Auto-detect system printers
  ipcMain.handle('detect-system-printers', () => detectSystemPrinters());

  // Phase 2: Auto-start
  ipcMain.handle('get-autostart', () => isAutoStartEnabled());
  ipcMain.handle('set-autostart', (_e, enabled: boolean) => setAutoStart(enabled));

  // Phase 2: Get all events (for history view)
  ipcMain.handle('get-all-events', () => store.getAllEvents());
}
