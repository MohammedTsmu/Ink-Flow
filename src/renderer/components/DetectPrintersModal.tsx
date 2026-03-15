import React, { useState, useEffect } from 'react';
import { SystemPrinter } from '../types';
import { useTheme } from '../ThemeContext';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface DetectPrintersModalProps {
  onClose: () => void;
  onSave: () => void;
}

export default function DetectPrintersModal({ onClose, onSave }: DetectPrintersModalProps) {
  useEscapeKey(onClose);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinter[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maxIdleDays, setMaxIdleDays] = useState(7);
  const [warningDays, setWarningDays] = useState(3);

  useEffect(() => {
    detectPrinters();
  }, []);

  const detectPrinters = async () => {
    setLoading(true);
    try {
      const printers = await window.api.detectSystemPrinters();
      setSystemPrinters(printers);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      for (const name of selected) {
        const sp = systemPrinters.find(p => p.name === name);
        if (sp) {
          await window.api.addPrinter({
            name: sp.name,
            model: sp.driverName,
            inkType: '',
            maxIdleDays,
            warningDays: Math.min(warningDays, maxIdleDays),
          });
        }
      }
      onSave();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-6 w-full max-w-lg shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-2">Detect System Printers</h2>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'} mb-4`}>Select printers from your system to add to Ink Flow.</p>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <svg className="animate-spin h-6 w-6 text-blue-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className={`ml-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Scanning system printers...</span>
          </div>
        ) : systemPrinters.length === 0 ? (
          <p className={`text-center ${isDark ? 'text-gray-500' : 'text-gray-400'} py-8`}>No printers detected on this system.</p>
        ) : (
          <>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {systemPrinters.map((sp) => (
                <label
                  key={sp.name}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selected.has(sp.name) ? 'bg-blue-600/20 border border-blue-600/50' : `${isDark ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-gray-50 border-gray-200 hover:border-gray-300'} border`
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(sp.name)}
                    onChange={() => toggleSelect(sp.name)}
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{sp.name}</p>
                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} truncate`}>{sp.driverName}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>Max Idle Days</label>
                <input
                  type="number"
                  value={maxIdleDays}
                  onChange={(e) => setMaxIdleDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className={`w-full px-3 py-2 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'} border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none`}
                  min="1"
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
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg transition-colors`}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={selected.size === 0 || saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Adding...' : `Add ${selected.size} Printer${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
