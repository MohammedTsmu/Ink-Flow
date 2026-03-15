import React from 'react';
import { PrinterWithStatus } from '../types';
import { useTheme } from '../ThemeContext';
import PrinterCard from './PrinterCard';

interface DashboardProps {
  printers: PrinterWithStatus[];
  onAddPrinter: () => void;
  onEditPrinter: (printer: PrinterWithStatus) => void;
  onRefresh: () => void;
  onDetectPrinters: () => void;
  onShowHistory: () => void;
  onShowSettings: () => void;
  onShowStats: () => void;
  onShowPrinterHistory: (printerId: number) => void;
}

export default function Dashboard({ printers, onAddPrinter, onEditPrinter, onRefresh, onDetectPrinters, onShowHistory, onShowSettings, onShowStats, onShowPrinterHistory }: DashboardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const overdue = printers.filter(p => p.status === 'overdue').length;
  const urgent  = printers.filter(p => p.status === 'urgent').length;
  const warning = printers.filter(p => p.status === 'warning').length;
  const good    = printers.filter(p => p.status === 'good').length;

  // Find the most severely overdue printer for the alert banner
  const severelyOverdue = printers
    .filter(p => p.status === 'overdue' && Math.abs(p.daysRemaining) >= p.maxIdleDays)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const btnClass = `flex items-center gap-2 px-3 py-2 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg transition-colors text-sm`;

  return (
    <div>
      {/* Critical alert banner */}
      {severelyOverdue.length > 0 && (
        <div className={`${isDark ? 'bg-red-950 border-red-800' : 'bg-red-50 border-red-200'} border rounded-xl p-4 mb-6`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">🚨</span>
            <div>
              <h3 className="font-bold text-red-400 text-sm">Critical: Printers Need Immediate Attention</h3>
              <div className="mt-2 space-y-1">
                {severelyOverdue.map(p => {
                  const overdueDays = Math.abs(Math.round(p.daysRemaining * 10) / 10);
                  return (
                    <p key={p.id} className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      <span className="font-semibold">{p.name}</span> — {overdueDays} days overdue
                      {overdueDays >= p.maxIdleDays * 2
                        ? ' (nozzles very likely clogged, deep clean needed)'
                        : ' (high risk of nozzle clogging)'}
                    </p>
                  );
                })}
              </div>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-2`}>
                Turn on the printer(s) and print or run a cleaning cycle immediately.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {overdue > 0 && (
            <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
              {overdue} Overdue
            </span>
          )}
          {urgent > 0 && (
            <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm font-medium">
              {urgent} Urgent
            </span>
          )}
          {warning > 0 && (
            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
              {warning} Warning
            </span>
          )}
          {good > 0 && (
            <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
              {good} Good
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={onDetectPrinters} className={btnClass}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Detect
          </button>
          <button onClick={onShowHistory} className={btnClass}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            History
          </button>
          <button onClick={onShowStats} className={btnClass}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Stats
          </button>
          <button onClick={onShowSettings} className={btnClass}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
          <button
            onClick={onAddPrinter}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Printer
          </button>
        </div>
      </div>

      {/* Printer grid */}
      {printers.length === 0 ? (
        <div className="text-center py-20">
          <svg className={`w-16 h-16 mx-auto ${isDark ? 'text-gray-700' : 'text-gray-300'} mb-4`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C12 2 5 10 5 15a7 7 0 0014 0C19 10 12 2 12 2z" />
          </svg>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-2`}>No printers yet</h2>
          <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} mb-6`}>Add your first printer to start tracking its maintenance schedule.</p>
          <button
            onClick={onAddPrinter}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            Add Your First Printer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {printers.map((printer) => (
            <PrinterCard
              key={printer.id}
              printer={printer}
              onEdit={() => onEditPrinter(printer)}
              onRefresh={onRefresh}
              onShowHistory={onShowPrinterHistory}
            />
          ))}
        </div>
      )}
    </div>
  );
}
