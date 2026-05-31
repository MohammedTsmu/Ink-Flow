import { ipcMain, dialog, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { getStore } from './store';
import { detectSystemPrinters, checkPrinterStatus } from './printer-detect';
import { isAutoStartEnabled, setAutoStart } from './autostart';
import { sendTestPrint } from './auto-print';
import { readRecentEntries } from '../core/log';
import { getAdapter } from '../core/printers';
import { getScheduleStatus, installSchedule, uninstallSchedule, refreshScheduleIfInstalled } from './schedule';
import { buildTickSummary, summaryWorthShowing } from '../core/tick-summary';

export function setupIpcHandlers(): void {
  const store = getStore();

  ipcMain.handle('get-printers', () => store.getPrinters());

  ipcMain.handle('get-app-version', () => app.getVersion());

  ipcMain.handle('add-printer', (_e, input) => store.addPrinter(input));

  ipcMain.handle('update-printer', (_e, id, input) => store.updatePrinter(id, input));

  ipcMain.handle('delete-printer', (_e, id) => store.deletePrinter(id));

  ipcMain.handle('get-events', (_e, printerId) => store.getEvents(printerId));

  ipcMain.handle('add-event', (_e, input) => store.addEvent(input));

  ipcMain.handle('get-printers-with-status', () => store.getPrintersWithStatus());

  // Phase 2: Auto-detect system printers
  ipcMain.handle('detect-system-printers', () => detectSystemPrinters());

  // Check if a printer is online/offline
  ipcMain.handle('check-printer-status', (_e, printerName: string) => checkPrinterStatus(printerName));

  // Phase 2: Auto-start
  ipcMain.handle('get-autostart', () => isAutoStartEnabled());
  ipcMain.handle('set-autostart', (_e, enabled: boolean) => setAutoStart(enabled));

  // Phase 2: Get all events (for history view)
  ipcMain.handle('get-all-events', () => store.getAllEvents());
  ipcMain.handle('delete-event', (_e, eventId: number) => store.deleteEvent(eventId));

  // Phase 3: Settings
  ipcMain.handle('get-settings', () => store.getSettings());
  ipcMain.handle('update-settings', async (_e, partial) => {
    const before = store.getSettings();
    const after = store.updateSettings(partial);
    // If tick interval changed and a schedule is installed, re-register
    // it so the new cadence takes effect without the user toggling off/on.
    if (partial && typeof partial.tickIntervalSeconds === 'number'
        && partial.tickIntervalSeconds !== before.tickIntervalSeconds) {
      try { await refreshScheduleIfInstalled(); } catch { /* logged inside */ }
    }
    return after;
  });

  // Phase 3: Statistics
  ipcMain.handle('get-statistics', () => store.getStatistics());

  // Phase 3: Manual test print
  ipcMain.handle('send-test-print', async (_e, printerName: string, printerId: number) => {
    const status = await checkPrinterStatus(printerName);
    if (status === 'offline') {
      return { success: false, reason: 'offline' };
    }
    const success = await sendTestPrint(printerName);
    if (success) {
      store.addEvent({ printerId, eventType: 'print', notes: 'Manual test print' });
    }
    return { success, reason: success ? null : 'print-failed' };
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

  // Diagnostics (Phase 1.4)
  ipcMain.handle('get-diagnostics', (_e, limit: number = 100) => readRecentEntries(limit));

  // Auto-detection prereqs (Phase 1.5)
  ipcMain.handle('get-detection-status', () => getAdapter().checkDetectionStatus());
  ipcMain.handle('attempt-fix-detection', () => getAdapter().attemptFixDetection());

  // Background maintenance schedule (Phase 2.3)
  ipcMain.handle('get-schedule-status', () => getScheduleStatus());
  ipcMain.handle('install-schedule', () => installSchedule());
  ipcMain.handle('uninstall-schedule', () => uninstallSchedule());

  // Tick summary since last GUI launch (3.0.11+)
  ipcMain.handle('get-tick-summary', () => {
    const since = store.getLastGuiStartAt() || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const summary = buildTickSummary(readRecentEntries(1000), since);
    return summaryWorthShowing(summary) ? summary : null;
  });
  ipcMain.handle('mark-summary-seen', () => {
    store.setLastGuiStartAt(new Date().toISOString());
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
