import { ipcMain, dialog, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { getStore } from './store';
import { detectSystemPrinters } from './printer-detect';
import { isAutoStartEnabled, setAutoStart } from './autostart';
import { sendTestPrint } from './auto-print';

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

  // Phase 3: Settings
  ipcMain.handle('get-settings', () => store.getSettings());
  ipcMain.handle('update-settings', (_e, partial) => store.updateSettings(partial));

  // Phase 3: Statistics
  ipcMain.handle('get-statistics', () => store.getStatistics());

  // Phase 3: Manual test print
  ipcMain.handle('send-test-print', async (_e, printerName: string, printerId: number) => {
    const success = await sendTestPrint(printerName);
    if (success) {
      store.addEvent({ printerId, eventType: 'print', notes: 'Manual test print' });
    }
    return success;
  });

  // Phase 3: Backup export
  ipcMain.handle('export-backup', async () => {
    const { canceled, filePath: savePath } = await dialog.showSaveDialog({
      title: 'Export Ink Flow Backup',
      defaultPath: path.join(app.getPath('documents'), 'inkflow-backup.json'),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !savePath) return false;
    fs.writeFileSync(savePath, store.exportData(), 'utf-8');
    return true;
  });

  // Phase 3: Backup import
  ipcMain.handle('import-backup', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Ink Flow Backup',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return false;
    const json = fs.readFileSync(filePaths[0], 'utf-8');
    return store.importData(json);
  });
}
