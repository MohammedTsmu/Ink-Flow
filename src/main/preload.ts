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
});
