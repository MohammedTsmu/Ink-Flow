import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { PrinterWithStatus } from '../types';

interface TestPanelProps {
  onClose: () => void;
  onRefresh: () => void;
}

export default function TestPanel({ onClose, onRefresh }: TestPanelProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [printers, setPrinters] = useState<PrinterWithStatus[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<number | null>(null);
  const [daysAgo, setDaysAgo] = useState(10);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.api.getPrintersWithStatus().then(p => {
      setPrinters(p);
      if (p.length > 0) setSelectedPrinter(p[0].id);
    });
  }, []);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSimulateOverdue = async () => {
    if (!selectedPrinter) return;
    setBusy(true);
    const ok = await window.api.testSimulateOverdue(selectedPrinter, daysAgo);
    setBusy(false);
    if (ok) {
      showFeedback(`Backdated last event by ${daysAgo} days — printer is now overdue!`);
      onRefresh();
    } else {
      showFeedback('Failed — no events found for this printer.');
    }
  };

  const handleSimulateWarning = async () => {
    if (!selectedPrinter) return;
    const printer = printers.find(p => p.id === selectedPrinter);
    if (!printer) return;
    // Set last event to maxIdleDays - warningDays + 1 days ago (enters warning zone)
    const daysBack = printer.maxIdleDays - printer.warningDays + 1;
    setBusy(true);
    await window.api.testSimulateOverdue(selectedPrinter, daysBack);
    setBusy(false);
    showFeedback(`Backdated by ${daysBack} days — printer should now be in warning zone!`);
    onRefresh();
  };

  const handleSimulateUrgent = async () => {
    if (!selectedPrinter) return;
    const printer = printers.find(p => p.id === selectedPrinter);
    if (!printer) return;
    // Set last event to maxIdleDays - 0.5 days ago (less than 1 day remaining)
    const daysBack = printer.maxIdleDays - 0.5;
    setBusy(true);
    await window.api.testSimulateOverdue(selectedPrinter, daysBack);
    setBusy(false);
    showFeedback(`Backdated by ${Math.round(daysBack * 10) / 10} days — printer should now be urgent!`);
    onRefresh();
  };

  const handleResetTimer = async () => {
    if (!selectedPrinter) return;
    setBusy(true);
    await window.api.addEvent({ printerId: selectedPrinter, eventType: 'clean', notes: 'Test reset — timer restarted' });
    setBusy(false);
    showFeedback('Timer reset — printer is back to "Good" status.');
    onRefresh();
  };

  const handleTriggerNotifications = async () => {
    setBusy(true);
    await window.api.testTriggerNotifications();
    setBusy(false);
    showFeedback('Notification check triggered — check your system tray!');
  };

  const handleTriggerPrintMonitor = async () => {
    setBusy(true);
    await window.api.testTriggerPrintMonitor();
    setBusy(false);
    showFeedback('Print log scanned! If you printed recently, events were auto-logged.');
    onRefresh();
  };

  const handleTriggerAutoMaintenance = async () => {
    setBusy(true);
    await window.api.testTriggerAutoMaintenance();
    setBusy(false);
    showFeedback('Auto-maintenance check complete.');
    onRefresh();
  };

  const btnBase = `px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40`;
  const btnPrimary = `${btnBase} bg-purple-600 hover:bg-purple-700 text-white`;
  const btnSecondary = `${btnBase} ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`;
  const btnWarning = `${btnBase} bg-yellow-600 hover:bg-yellow-700 text-white`;
  const btnDanger = `${btnBase} bg-red-600 hover:bg-red-700 text-white`;
  const btnSuccess = `${btnBase} bg-green-600 hover:bg-green-700 text-white`;

  const selectedName = printers.find(p => p.id === selectedPrinter)?.name || '';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xl">🧪</span>
          <h2 className="text-xl font-bold">Test Panel</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-600'}`}>Debug</span>
        </div>

        {printers.length === 0 ? (
          <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-center py-6`}>
            Add a printer first to use test features.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Printer selector */}
            <div className={`p-3 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg`}>
              <label className="block text-sm font-medium mb-2">Select Printer</label>
              <select
                value={selectedPrinter ?? ''}
                onChange={e => setSelectedPrinter(Number(e.target.value))}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              >
                {printers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.status} ({p.daysRemaining > 0 ? `${p.daysRemaining}d left` : `${Math.abs(p.daysRemaining)}d overdue`})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick status simulations */}
            <div className={`p-3 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg`}>
              <p className="font-medium text-sm mb-1">Quick Status Simulation</p>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-3`}>
                Instantly change "{selectedName}" to a specific status.
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleSimulateWarning} disabled={busy} className={btnWarning}>
                  ⚠ Make Warning
                </button>
                <button onClick={handleSimulateUrgent} disabled={busy} className={`${btnBase} bg-orange-600 hover:bg-orange-700 text-white`}>
                  🔴 Make Urgent
                </button>
                <button onClick={() => { setDaysAgo(10); handleSimulateOverdue(); }} disabled={busy} className={btnDanger}>
                  ❌ Make Overdue
                </button>
                <button onClick={handleResetTimer} disabled={busy} className={btnSuccess}>
                  ✅ Reset to Good
                </button>
              </div>
            </div>

            {/* Custom overdue simulation */}
            <div className={`p-3 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg`}>
              <p className="font-medium text-sm mb-1">Custom Time Warp</p>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-3`}>
                Backdate the last event by a specific number of days.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={daysAgo}
                  onChange={e => setDaysAgo(Math.max(1, Number(e.target.value)))}
                  className={`w-20 px-3 py-2 rounded-lg border text-sm ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>days ago</span>
                <button onClick={handleSimulateOverdue} disabled={busy} className={btnPrimary}>
                  Apply
                </button>
              </div>
            </div>

            {/* System triggers */}
            <div className={`p-3 ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg`}>
              <p className="font-medium text-sm mb-1">Trigger System Features</p>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mb-3`}>
                Run background features on-demand instead of waiting.
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleTriggerNotifications} disabled={busy} className={btnSecondary}>
                  🔔 Trigger Notifications
                </button>
                <button onClick={handleTriggerPrintMonitor} disabled={busy} className={btnSecondary}>
                  📋 Scan Print Log
                </button>
                <button onClick={handleTriggerAutoMaintenance} disabled={busy} className={btnSecondary}>
                  🖨 Run Auto-Maintenance
                </button>
              </div>
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`p-3 rounded-lg text-sm ${isDark ? 'bg-purple-900/40 text-purple-300 border border-purple-700' : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
                {feedback}
              </div>
            )}
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
