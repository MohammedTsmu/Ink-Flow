import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { AppSettings } from '../types';

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [autoStart, setAutoStart] = useState(false);
  const [autoMaintenancePrint, setAutoMaintenancePrint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [enabled, settings] = await Promise.all([
        window.api.getAutoStart(),
        window.api.getSettings(),
      ]);
      setAutoStart(enabled);
      setAutoMaintenancePrint(settings.autoMaintenancePrint);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoStartToggle = async () => {
    const next = !autoStart;
    setAutoStart(next);
    await window.api.setAutoStart(next);
  };

  const handleAutoMaintenancePrintToggle = async () => {
    const next = !autoMaintenancePrint;
    setAutoMaintenancePrint(next);
    await window.api.updateSettings({ autoMaintenancePrint: next });
  };

  const handleExport = async () => {
    setBackupStatus(null);
    const success = await window.api.exportBackup();
    setBackupStatus(success ? 'Backup exported successfully!' : 'Export cancelled.');
    setTimeout(() => setBackupStatus(null), 3000);
  };

  const handleImport = async () => {
    setBackupStatus(null);
    const success = await window.api.importBackup();
    setBackupStatus(success ? 'Backup restored! Restart recommended.' : 'Import cancelled.');
    setTimeout(() => setBackupStatus(null), 5000);
  };

  const toggleBtnClass = (on: boolean) =>
    `relative w-11 h-6 rounded-full transition-colors ${on ? 'bg-blue-600' : isDark ? 'bg-gray-600' : 'bg-gray-300'}`;

  const toggleDotClass = (on: boolean) =>
    `absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-6 w-full max-w-md shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-5">Settings</h2>

        {loading ? (
          <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-center py-6`}>Loading...</p>
        ) : (
          <div className="space-y-4">
            {/* Auto-start */}
            <div className={`flex items-center justify-between p-3 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg`}>
              <div>
                <p className="font-medium text-sm">Start with Windows</p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>Launch Ink Flow automatically when you log in</p>
              </div>
              <button onClick={handleAutoStartToggle} className={toggleBtnClass(autoStart)}>
                <span className={toggleDotClass(autoStart)} />
              </button>
            </div>

            {/* Auto maintenance print */}
            <div className={`flex items-center justify-between p-3 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg`}>
              <div>
                <p className="font-medium text-sm">Auto Maintenance Print</p>
                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>Automatically send a test page when printers are overdue</p>
              </div>
              <button onClick={handleAutoMaintenancePrintToggle} className={toggleBtnClass(autoMaintenancePrint)}>
                <span className={toggleDotClass(autoMaintenancePrint)} />
              </button>
            </div>

            {/* Backup & Restore */}
            <div className={`p-3 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg`}>
              <p className="font-medium text-sm mb-2">Backup & Restore</p>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-3`}>Export or import your printer data and settings.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  className={`flex-1 px-3 py-1.5 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg text-sm font-medium transition-colors`}
                >
                  Export Backup
                </button>
                <button
                  onClick={handleImport}
                  className={`flex-1 px-3 py-1.5 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg text-sm font-medium transition-colors`}
                >
                  Import Backup
                </button>
              </div>
              {backupStatus && (
                <p className="text-xs text-blue-400 mt-2">{backupStatus}</p>
              )}
            </div>

            {/* Notification info */}
            <div className={`p-3 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg`}>
              <p className="font-medium text-sm mb-2">Alert Levels</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}><span className="text-green-500 font-medium">Good</span> — Plenty of time remaining</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}><span className="text-yellow-500 font-medium">Warning</span> — Approaching maintenance deadline</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}><span className="text-orange-500 font-medium">Urgent</span> — Less than 1 day left</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className={isDark ? 'text-gray-400' : 'text-gray-500'}><span className="text-red-500 font-medium">Overdue</span> — Past deadline</span>
                </div>
              </div>
            </div>

            {/* About */}
            <div className={`p-3 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg`}>
              <p className="font-medium text-sm">About</p>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>Ink Flow v1.0.0 — Printer Maintenance Tracker</p>
              <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'} mt-0.5`}>Keeps your liquid-ink printers healthy by tracking idle time.</p>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            onClick={onClose}
            className={`px-4 py-2 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg transition-colors`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
