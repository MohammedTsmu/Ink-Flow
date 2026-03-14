import React from 'react';
import { PrinterWithStatus } from '../types';
import PrinterCard from './PrinterCard';

interface DashboardProps {
  printers: PrinterWithStatus[];
  onAddPrinter: () => void;
  onEditPrinter: (printer: PrinterWithStatus) => void;
  onRefresh: () => void;
}

export default function Dashboard({ printers, onAddPrinter, onEditPrinter, onRefresh }: DashboardProps) {
  const overdue = printers.filter(p => p.status === 'overdue').length;
  const urgent  = printers.filter(p => p.status === 'urgent').length;
  const warning = printers.filter(p => p.status === 'warning').length;
  const good    = printers.filter(p => p.status === 'good').length;

  return (
    <div>
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

      {/* Printer grid */}
      {printers.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 mx-auto text-gray-700 mb-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C12 2 5 10 5 15a7 7 0 0014 0C19 10 12 2 12 2z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-400 mb-2">No printers yet</h2>
          <p className="text-gray-500 mb-6">Add your first printer to start tracking its maintenance schedule.</p>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
