import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  addPrinter: (printer: { name: string; model: string; inkType: string; maxIdleDays: number; warningDays: number }) =>
    ipcRenderer.invoke('add-printer', printer),
  updatePrinter: (id: number, printer: { name?: string; model?: string; inkType?: string; maxIdleDays?: number; warningDays?: number }) =>
    ipcRenderer.invoke('update-printer', id, printer),
  deletePrinter: (id: number) => ipcRenderer.invoke('delete-printer', id),
  getEvents: (printerId: number) => ipcRenderer.invoke('get-events', printerId),
  addEvent: (event: { printerId: number; eventType: string; notes?: string }) =>
    ipcRenderer.invoke('add-event', event),
  getPrintersWithStatus: () => ipcRenderer.invoke('get-printers-with-status'),
  // Phase 2
  detectSystemPrinters: () => ipcRenderer.invoke('detect-system-printers'),
  checkPrinterStatus: (printerName: string) => ipcRenderer.invoke('check-printer-status', printerName),
  getAutoStart: () => ipcRenderer.invoke('get-autostart'),
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke('set-autostart', enabled),
  getAllEvents: () => ipcRenderer.invoke('get-all-events'),
  deleteEvent: (eventId: number) => ipcRenderer.invoke('delete-event', eventId),
  // Phase 3
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (partial: Record<string, unknown>) => ipcRenderer.invoke('update-settings', partial),
  getStatistics: () => ipcRenderer.invoke('get-statistics'),
  sendTestPrint: (printerName: string, printerId: number) => ipcRenderer.invoke('send-test-print', printerName, printerId),
  exportBackup: () => ipcRenderer.invoke('export-backup'),
  importBackup: () => ipcRenderer.invoke('import-backup'),
  // Test / Debug
  testSimulateOverdue: (printerId: number, daysAgo: number) => ipcRenderer.invoke('test-simulate-overdue', printerId, daysAgo),
  testTriggerNotifications: () => ipcRenderer.invoke('test-trigger-notifications'),
  testTriggerPrintMonitor: () => ipcRenderer.invoke('test-trigger-print-monitor'),
  testTriggerAutoMaintenance: () => ipcRenderer.invoke('test-trigger-auto-maintenance'),
  // Alert listener
  onPrinterAlerts: (callback: (alerts: Array<{ name: string; status: string; level: string; message: string }>) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, alerts: Array<{ name: string; status: string; level: string; message: string }>) => callback(alerts);
    ipcRenderer.on('printer-alerts', handler);
    return () => { ipcRenderer.removeListener('printer-alerts', handler); };
  },
});
