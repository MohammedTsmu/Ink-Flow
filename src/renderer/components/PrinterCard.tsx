import React, { useState } from 'react';
import { PrinterWithStatus } from '../types';
import { useTheme } from '../ThemeContext';

interface PrinterCardProps {
  printer: PrinterWithStatus;
  onEdit: () => void;
  onRefresh: () => void;
  onShowHistory: (printerId: number) => void;
}

const statusStyles = {
  good:    { bg: 'bg-green-500',  light: 'bg-green-500/20',  text: 'text-green-400',  label: 'Good' },
  warning: { bg: 'bg-yellow-500', light: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Warning' },
  urgent:  { bg: 'bg-orange-500', light: 'bg-orange-500/20', text: 'text-orange-400', label: 'Urgent' },
  overdue: { bg: 'bg-red-500',    light: 'bg-red-500/20',    text: 'text-red-400',    label: 'Overdue' },
};

export default function PrinterCard({ printer, onEdit, onRefresh, onShowHistory }: PrinterCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(false);
  const [testPrinting, setTestPrinting] = useState(false);
  const style = statusStyles[printer.status];
  const progress = Math.min(100, Math.max(0, (printer.daysRemaining / printer.maxIdleDays) * 100));

  const handleMaintenance = async (type: 'print' | 'clean') => {
    setLoading(true);
    try {
      await window.api.addEvent({ printerId: printer.id, eventType: type });
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleTestPrint = async () => {
    setTestPrinting(true);
    try {
      await window.api.sendTestPrint(printer.name, printer.id);
      await window.api.addEvent({ printerId: printer.id, eventType: 'print' });
      onRefresh();
    } finally {
      setTestPrinting(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Delete printer "${printer.name}"? This cannot be undone.`)) {
      await window.api.deletePrinter(printer.id);
      onRefresh();
    }
  };

  return (
    <div className={`${isDark ? 'bg-gray-900 border-gray-800 hover:border-gray-700' : 'bg-white border-gray-200 hover:border-gray-300'} border rounded-xl p-5 transition-colors`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 mr-2">
          <h3 className="font-semibold text-lg truncate">{printer.name}</h3>
          {printer.model && <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} truncate`}>{printer.model}</p>}
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${style.light} ${style.text}`}>
          {style.label}
        </span>
      </div>

      {/* Ink type */}
      {printer.inkType && (
        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-3`}>Ink: {printer.inkType}</p>
      )}

      {/* Days remaining */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Days remaining</span>
          <span className={`font-bold ${style.text}`}>
            {printer.status === 'overdue' ? 'Overdue' : `${Math.round(printer.daysRemaining * 10) / 10}d`}
          </span>
        </div>
        <div className={`w-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded-full h-2`}>
          <div
            className={`h-2 rounded-full transition-all duration-500 ${style.bg}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className={`flex justify-between text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
          <span>Max: {printer.maxIdleDays}d</span>
          {printer.lastEvent && (
            <span>Last: {new Date(printer.lastEvent.eventDate).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {/* Maintenance actions */}
      <div className="flex gap-2">
        <button
          onClick={() => handleMaintenance('print')}
          disabled={loading}
          className="flex-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          Printed
        </button>
        <button
          onClick={() => handleMaintenance('clean')}
          disabled={loading}
          className="flex-1 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          Cleaned
        </button>
        <button
          onClick={handleTestPrint}
          disabled={testPrinting}
          className="flex-1 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {testPrinting ? 'Printing...' : 'Test Print'}
        </button>
      </div>

      {/* Edit / History / Delete */}
      <div className="flex gap-2 mt-2">
        <button
          onClick={onEdit}
          className={`flex-1 px-3 py-1.5 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'} rounded-lg text-sm transition-colors`}
        >
          Edit
        </button>
        <button
          onClick={() => onShowHistory(printer.id)}
          className={`flex-1 px-3 py-1.5 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'} rounded-lg text-sm transition-colors`}
        >
          History
        </button>
        <button
          onClick={handleDelete}
          className={`px-3 py-1.5 ${isDark ? 'bg-gray-800 hover:bg-red-900/50 text-gray-400' : 'bg-gray-100 hover:bg-red-100 text-gray-500'} hover:text-red-400 rounded-lg text-sm transition-colors`}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
