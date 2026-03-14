import React, { useState } from 'react';
import { PrinterWithStatus } from '../types';
import { useTheme } from '../ThemeContext';

interface EditPrinterModalProps {
  printer: PrinterWithStatus;
  onClose: () => void;
  onSave: () => void;
}

export default function EditPrinterModal({ printer, onClose, onSave }: EditPrinterModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [name, setName] = useState(printer.name);
  const [model, setModel] = useState(printer.model);
  const [inkType, setInkType] = useState(printer.inkType);
  const [maxIdleDays, setMaxIdleDays] = useState(printer.maxIdleDays);
  const [warningDays, setWarningDays] = useState(printer.warningDays);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await window.api.updatePrinter(printer.id, {
        name: name.trim(),
        model: model.trim(),
        inkType: inkType.trim(),
        maxIdleDays,
        warningDays: Math.min(warningDays, maxIdleDays),
      });
      onSave();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-6 w-full max-w-md shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-5">Edit Printer</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Printer Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none`}
              required
              autoFocus
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={`w-full px-3 py-2 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Ink Type</label>
            <input
              type="text"
              value={inkType}
              onChange={(e) => setInkType(e.target.value)}
              className={`w-full px-3 py-2 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Max Idle Days *</label>
              <input
                type="number"
                value={maxIdleDays}
                onChange={(e) => setMaxIdleDays(Math.max(1, parseInt(e.target.value) || 1))}
                className={`w-full px-3 py-2 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none`}
                min="1"
                required
              />
            </div>
            <div>
              <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Warning Days</label>
              <input
                type="number"
                value={warningDays}
                onChange={(e) => setWarningDays(Math.max(1, parseInt(e.target.value) || 1))}
                className={`w-full px-3 py-2 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none`}
                min="1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg transition-colors`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
