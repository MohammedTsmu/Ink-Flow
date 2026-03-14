import { ipcMain } from 'electron';
import { getStore } from './store';

export function setupIpcHandlers(): void {
  const store = getStore();

  ipcMain.handle('get-printers', () => store.getPrinters());

  ipcMain.handle('add-printer', (_e, input) => store.addPrinter(input));

  ipcMain.handle('update-printer', (_e, id, input) => store.updatePrinter(id, input));

  ipcMain.handle('delete-printer', (_e, id) => store.deletePrinter(id));

  ipcMain.handle('get-events', (_e, printerId) => store.getEvents(printerId));

  ipcMain.handle('add-event', (_e, input) => store.addEvent(input));

  ipcMain.handle('get-printers-with-status', () => store.getPrintersWithStatus());
}
