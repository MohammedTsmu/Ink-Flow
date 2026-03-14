import React, { useState, useEffect } from 'react';

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [autoStart, setAutoStart] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const enabled = await window.api.getAutoStart();
      setAutoStart(enabled);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoStartToggle = async () => {
    const next = !autoStart;
    setAutoStart(next);
    await window.api.setAutoStart(next);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-5">Settings</h2>

        {loading ? (
          <p className="text-gray-500 text-center py-6">Loading...</p>
        ) : (
          <div className="space-y-4">
            {/* Auto-start */}
            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <div>
                <p className="font-medium text-sm">Start with Windows</p>
                <p className="text-xs text-gray-500 mt-0.5">Launch Ink Flow automatically when you log in</p>
              </div>
              <button
                onClick={handleAutoStartToggle}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  autoStart ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    autoStart ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Notification info */}
            <div className="p-3 bg-gray-800 rounded-lg">
              <p className="font-medium text-sm mb-2">Alert Levels</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-gray-400"><span className="text-green-400 font-medium">Good</span> — Plenty of time remaining</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  <span className="text-gray-400"><span className="text-yellow-400 font-medium">Warning</span> — Approaching maintenance deadline (desktop notification)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span className="text-gray-400"><span className="text-orange-400 font-medium">Urgent</span> — Less than 1 day left (critical notification)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="text-gray-400"><span className="text-red-400 font-medium">Overdue</span> — Past deadline (critical notification)</span>
                </div>
              </div>
            </div>

            {/* About */}
            <div className="p-3 bg-gray-800 rounded-lg">
              <p className="font-medium text-sm">About</p>
              <p className="text-xs text-gray-500 mt-1">Ink Flow v1.0.0 — Printer Maintenance Tracker</p>
              <p className="text-xs text-gray-600 mt-0.5">Keeps your liquid-ink printers healthy by tracking idle time.</p>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
