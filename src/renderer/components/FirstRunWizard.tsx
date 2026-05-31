import React, { useEffect, useState } from 'react';
import { useTheme } from '../ThemeContext';
import { SystemPrinter, DetectionStatus } from '../types';

interface FirstRunWizardProps {
  onFinish: () => void;
}

interface DetectedRow {
  printer: SystemPrinter;
  selected: boolean;
}

/**
 * Three-step onboarding shown on first launch:
 *   1. Detect installed printers and let the user pick which to track.
 *   2. Offer to turn on Background Maintenance (cross-platform tick).
 *   3. Verify auto-detection prereqs (Windows: PrintService log).
 *
 * Each step is skippable. After the last step (or explicit Skip All)
 * the wizard marks first-run complete so it never appears again.
 */
export default function FirstRunWizard({ onFinish }: FirstRunWizardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  // Step 1 state
  const [detected, setDetected] = useState<DetectedRow[]>([]);
  const [detectionRan, setDetectionRan] = useState(false);
  const [addStatus, setAddStatus] = useState<string | null>(null);

  // Step 2 state
  const [scheduleInstalled, setScheduleInstalled] = useState(false);
  const [scheduleErr, setScheduleErr] = useState<string | null>(null);

  // Step 3 state
  const [detection, setDetection] = useState<DetectionStatus | null>(null);
  const [fixErr, setFixErr] = useState<string | null>(null);

  useEffect(() => {
    if (step === 3) {
      window.api.getDetectionStatus().then(setDetection);
    }
  }, [step]);

  const runDetection = async () => {
    setBusy(true);
    try {
      const printers = await window.api.detectSystemPrinters();
      setDetected(printers.map(p => ({ printer: p, selected: true })));
      setDetectionRan(true);
    } finally {
      setBusy(false);
    }
  };

  const toggleSelected = (idx: number) => {
    setDetected(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  const addSelected = async () => {
    setBusy(true);
    setAddStatus(null);
    try {
      let count = 0;
      for (const row of detected) {
        if (!row.selected) continue;
        await window.api.addPrinter({
          name: row.printer.name,
          model: row.printer.driverName || '',
          inkType: '',
          maxIdleDays: 7,
          warningDays: 2,
        });
        count++;
      }
      setAddStatus(count > 0 ? `Added ${count} printer${count === 1 ? '' : 's'}.` : 'No printers selected.');
    } finally {
      setBusy(false);
    }
  };

  const enableSchedule = async () => {
    setBusy(true);
    setScheduleErr(null);
    try {
      const result = await window.api.installSchedule();
      if (result.success) {
        setScheduleInstalled(true);
      } else {
        setScheduleErr(result.reason || 'Could not install background tick.');
      }
    } finally {
      setBusy(false);
    }
  };

  const enableDetection = async () => {
    setBusy(true);
    setFixErr(null);
    try {
      const result = await window.api.attemptFixDetection();
      if (result.success) {
        const refreshed = await window.api.getDetectionStatus();
        setDetection(refreshed);
      } else {
        setFixErr(result.reason || 'Could not enable.');
      }
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    await window.api.markFirstRunCompleted();
    onFinish();
  };

  const isWindows = navigator.userAgent.toLowerCase().includes('windows');
  const lastStep = isWindows ? 3 : 2;

  const tile = isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200';
  const body = isDark ? 'text-gray-300' : 'text-gray-700';
  const subtle = isDark ? 'text-gray-500' : 'text-gray-400';

  const stepDot = (n: number) => (
    <div className={`flex items-center gap-2 ${n === step ? body : subtle}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        n < step ? 'bg-green-600 text-white' :
        n === step ? 'bg-blue-600 text-white' :
        isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
      }`}>{n < step ? '✓' : n}</span>
      <span className="text-xs hidden sm:inline">{
        n === 1 ? 'Printers' :
        n === 2 ? 'Background' : 'Detection'
      }</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div
        className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl w-full max-w-xl shadow-2xl`}
      >
        {/* Header */}
        <div className={`px-6 py-5 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <h2 className="text-2xl font-bold mb-1">Welcome to Ink Flow 🖨️</h2>
          <p className={`text-sm ${subtle}`}>Three quick steps to set things up. You can skip any of them and configure later in Settings.</p>
          <div className="flex items-center gap-3 mt-4">
            {stepDot(1)}
            <div className={`flex-1 h-px ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
            {stepDot(2)}
            {isWindows && <>
              <div className={`flex-1 h-px ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
              {stepDot(3)}
            </>}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[280px]">
          {step === 1 && (
            <div className="space-y-3">
              <p className={`text-sm ${body}`}>Let's find the printers installed on your system. You can also add others manually later.</p>
              {!detectionRan ? (
                <button
                  onClick={runDetection}
                  disabled={busy}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {busy ? 'Scanning…' : 'Detect installed printers'}
                </button>
              ) : detected.length === 0 ? (
                <p className={`text-sm ${subtle} text-center py-4`}>No printers found on this system. Click "Skip" — you can add them manually later.</p>
              ) : (
                <div className={`${tile} border rounded-lg max-h-64 overflow-y-auto`}>
                  {detected.map((row, i) => (
                    <label key={row.printer.name + i} className={`flex items-start gap-3 p-3 cursor-pointer ${i > 0 ? `border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}` : ''}`}>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => toggleSelected(i)}
                        className="mt-0.5 accent-blue-500"
                      />
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${body} truncate`}>{row.printer.name}</p>
                        {row.printer.driverName && <p className={`text-xs ${subtle} truncate`}>{row.printer.driverName}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {addStatus && <p className={`text-xs ${body}`}>{addStatus}</p>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className={`text-sm ${body}`}>
                Ink Flow can run a tiny background task every few hours to check on your printers — even when this app is closed.
                That way overdue printers get a maintenance print without you having to remember.
              </p>
              <div className={`${tile} border rounded-lg p-4`}>
                <p className="font-medium text-sm mb-2">Background Maintenance</p>
                <p className={`text-xs ${subtle} mb-3`}>Registers a scheduled task with your OS. You can change the cadence or turn it off any time from Settings → Automation.</p>
                {scheduleInstalled ? (
                  <p className="text-sm text-green-400">✓ Background tick installed.</p>
                ) : (
                  <button
                    onClick={enableSchedule}
                    disabled={busy}
                    className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {busy ? 'Installing…' : 'Enable Background Maintenance'}
                  </button>
                )}
                {scheduleErr && <p className="text-xs text-red-400 mt-2">{scheduleErr}</p>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className={`text-sm ${body}`}>
                When you print from any program, Ink Flow can detect it and automatically reset the maintenance timer. On Windows this requires the PrintService event log to be enabled.
              </p>
              {!detection ? (
                <p className={`text-sm ${subtle}`}>Checking status…</p>
              ) : (
                <div className={`${tile} border rounded-lg p-4`}>
                  <div className="flex items-start gap-2 mb-3">
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${detection.available ? 'bg-green-500' : 'bg-red-500'}`} />
                    <p className={`text-xs ${body}`}>{detection.reason}</p>
                  </div>
                  {!detection.available && detection.fixable && (
                    <button
                      onClick={enableDetection}
                      disabled={busy}
                      className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {busy ? 'Requesting admin permission…' : (detection.actionHint || 'Enable')}
                    </button>
                  )}
                  {fixErr && <p className="text-xs text-red-400 mt-2">{fixErr}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'} flex items-center justify-between gap-3`}>
          <button
            onClick={finish}
            className={`text-xs ${subtle} hover:${body} transition-colors`}
          >
            Skip the rest
          </button>
          <div className="flex gap-2">
            {step === 1 && detectionRan && detected.some(r => r.selected) && (
              <button
                onClick={addSelected}
                disabled={busy}
                className={`px-3 py-1.5 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg text-sm transition-colors disabled:opacity-50`}
              >
                Add selected
              </button>
            )}
            {step < lastStep ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={finish}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
