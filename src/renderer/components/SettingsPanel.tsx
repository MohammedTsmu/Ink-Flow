import React, { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { DetectionStatus, DetectionFixResult, ScheduleStatus, ScheduleResult, UpdateState } from '../types';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface SettingsPanelProps {
  onClose: () => void;
}

type TabId = 'general' | 'automation' | 'detection' | 'backup';

const TABS: { id: TabId; label: string; icon: JSX.Element }[] = [
  {
    id: 'general',
    label: 'General',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      </svg>
    ),
  },
  {
    id: 'automation',
    label: 'Automation',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    id: 'detection',
    label: 'Detection',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    id: 'backup',
    label: 'Backup',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  },
];

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  useEscapeKey(onClose);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [tab, setTab] = useState<TabId>('general');
  const [autoStart, setAutoStart] = useState(false);
  const [autoMaintenancePrint, setAutoMaintenancePrint] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectionStatus | null>(null);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<DetectionFixResult | null>(null);
  const [schedule, setSchedule] = useState<ScheduleStatus | null>(null);
  const [schedulePending, setSchedulePending] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null);
  const [lastScheduleOp, setLastScheduleOp] = useState<'install' | 'uninstall' | null>(null);
  const [maintenanceWindow, setMaintenanceWindow] = useState<{ startHour: number; endHour: number } | null>(null);
  const [tickInterval, setTickInterval] = useState<number>(6 * 60 * 60);
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' });
  const [updateChecking, setUpdateChecking] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  // Poll the auto-updater state every 2 s while the General tab is open so
  // "Downloading: NN%" actually advances and the "Restart & install" button
  // appears the moment the download is done. Without this the renderer
  // only sees the snapshot from the original loadSettings call.
  useEffect(() => {
    if (tab !== 'general') return;
    const interval = setInterval(async () => {
      try {
        const fresh = await window.api.getUpdateState();
        setUpdateState(fresh);
      } catch { /* main process likely quitting */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [tab]);

  const loadSettings = async () => {
    // Fast lane — settings + version are an in-memory JSON read and a
    // string lookup. Both come back in <5 ms; we can render the panel
    // immediately. The slow lane (PowerShell-backed status queries) fills
    // in afterwards without blocking the UI.
    try {
      const [enabled, settings, version] = await Promise.all([
        window.api.getAutoStart(),
        window.api.getSettings(),
        window.api.getAppVersion(),
      ]);
      setAutoStart(enabled);
      setAutoMaintenancePrint(settings.autoMaintenancePrint);
      setMaintenanceWindow(settings.maintenanceWindow ?? { startHour: 0, endHour: 24 });
      setTickInterval(settings.tickIntervalSeconds ?? 6 * 60 * 60);
      setAppVersion(version);
      setLoading(false);
    } catch {
      setLoading(false);
    }

    // Slow lane: these each spawn a PowerShell process and can take 1-3s
    // on Windows. Run them in parallel after the fast lane has rendered.
    window.api.getDetectionStatus().then(setDetection).catch(() => { /* surfaced in diagnostics */ });
    window.api.getScheduleStatus().then(setSchedule).catch(() => { /* surfaced in diagnostics */ });
    window.api.getUpdateState().then(setUpdateState).catch(() => { /* surfaced in diagnostics */ });
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

  const handleWindowChange = async (next: { startHour: number; endHour: number }) => {
    setMaintenanceWindow(next);
    await window.api.updateSettings({ maintenanceWindow: next });
  };

  const handleTickIntervalChange = async (seconds: number) => {
    setTickInterval(seconds);
    await window.api.updateSettings({ tickIntervalSeconds: seconds });
    // The schedule auto-reinstalls server-side; refresh status to show new cadence.
    const refreshed = await window.api.getScheduleStatus();
    setSchedule(refreshed);
  };

  const TICK_OPTIONS = [
    { value: 60 * 60,           label: 'Every hour' },
    { value: 3 * 60 * 60,       label: 'Every 3 hours' },
    { value: 6 * 60 * 60,       label: 'Every 6 hours' },
    { value: 12 * 60 * 60,      label: 'Every 12 hours' },
    { value: 24 * 60 * 60,      label: 'Once a day' },
    { value: 7 * 24 * 60 * 60,  label: 'Once a week' },
  ];

  const handleCheckUpdates = async () => {
    setUpdateChecking(true);
    try {
      const result = await window.api.checkForUpdates();
      setUpdateState(result);
    } finally {
      setUpdateChecking(false);
    }
  };

  const handleInstallUpdate = async () => {
    await window.api.quitAndInstallUpdate();
  };

  const updateStateText = (s: UpdateState): string => {
    switch (s.status) {
      case 'idle':          return 'No check performed yet this session.';
      case 'checking':      return 'Checking for updates…';
      case 'not-available': return `You’re on the latest version. (last checked ${new Date(s.lastChecked).toLocaleTimeString()})`;
      case 'available':     return `Update available: v${s.version}. Downloading…`;
      case 'downloading':   return `Downloading v${s.version}: ${s.percent}%`;
      case 'downloaded':    return `v${s.version} downloaded. Click below to restart and install.`;
      case 'error': {
        // The raw electron-updater error can be a wall of stack-trace text
        // (50+ lines). Truncate the in-UI display so it doesn't bury the
        // rest of the General tab; full text is in diagnostics.log.
        const first = s.message.split(/\r?\n/)[0].slice(0, 200);
        return `Update check failed: ${first}`;
      }
    }
  };

  const handleEnableDetection = async () => {
    setFixing(true);
    setFixResult(null);
    try {
      const result = await window.api.attemptFixDetection();
      setFixResult(result);
      if (result.success) {
        const refreshed = await window.api.getDetectionStatus();
        setDetection(refreshed);
      }
    } finally {
      setFixing(false);
      setTimeout(() => setFixResult(null), 6000);
    }
  };

  const handleScheduleToggle = async () => {
    setSchedulePending(true);
    setScheduleResult(null);
    const wantOn = !schedule?.installed;
    setLastScheduleOp(wantOn ? 'install' : 'uninstall');
    try {
      const result = wantOn
        ? await window.api.installSchedule()
        : await window.api.uninstallSchedule();
      setScheduleResult(result);
      const refreshed = await window.api.getScheduleStatus();
      setSchedule(refreshed);
    } finally {
      setSchedulePending(false);
      setTimeout(() => { setScheduleResult(null); setLastScheduleOp(null); }, 8000);
    }
  };

  const handleExport = async () => {
    setBackupStatus(null);
    const success = await window.api.exportBackup();
    setBackupStatus(success ? 'Backup exported successfully.' : 'Export cancelled.');
    setTimeout(() => setBackupStatus(null), 3000);
  };

  const handleImport = async () => {
    setBackupStatus(null);
    const success = await window.api.importBackup();
    setBackupStatus(success ? 'Backup restored. Restart recommended.' : 'Import cancelled.');
    setTimeout(() => setBackupStatus(null), 5000);
  };

  const toggleBtnClass = (on: boolean) =>
    `relative w-11 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-blue-600' : isDark ? 'bg-gray-600' : 'bg-gray-300'}`;
  const toggleDotClass = (on: boolean) =>
    `absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`;

  const tile = isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200';
  const subtle = isDark ? 'text-gray-500' : 'text-gray-400';
  const body = isDark ? 'text-gray-300' : 'text-gray-700';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow-2xl w-full max-w-2xl flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: 'min(90vh, 640px)' }}
      >
        {/* Header + tab strip */}
        <div className={`px-6 pt-5 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <h2 className="text-xl font-bold mb-4">Settings</h2>
          <div className="flex gap-1 -mb-px">
            {TABS.map(t => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? `border-blue-500 ${isDark ? 'text-blue-400' : 'text-blue-600'}`
                      : `border-transparent ${subtle} hover:${body}`
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <p className={`${subtle} text-center py-10`}>Loading…</p>
          ) : (
            <>
              {tab === 'general' && (
                <div className="space-y-3">
                  <div className={`flex items-center justify-between p-3 ${tile} border rounded-lg`}>
                    <div>
                      <p className="font-medium text-sm">Start with Windows</p>
                      <p className={`text-xs ${subtle} mt-0.5`}>Launch Ink Flow automatically when you log in (minimised to tray)</p>
                    </div>
                    <button onClick={handleAutoStartToggle} className={toggleBtnClass(autoStart)}>
                      <span className={toggleDotClass(autoStart)} />
                    </button>
                  </div>

                  <div className={`p-3 ${tile} border rounded-lg`}>
                    <p className="font-medium text-sm mb-2">Updates</p>
                    <p className={`text-xs ${subtle} mb-3 break-words`}>{updateStateText(updateState)}</p>
                    {updateState.status === 'downloading' && (
                      <div className={`h-1.5 ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full overflow-hidden mb-3`}>
                        <div
                          className="h-full bg-blue-500 transition-all duration-200"
                          style={{ width: `${Math.max(2, updateState.percent)}%` }}
                        />
                      </div>
                    )}
                    <div className="flex gap-2">
                      {updateState.status === 'downloaded' ? (
                        <button
                          onClick={handleInstallUpdate}
                          className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Restart &amp; install v{updateState.version}
                        </button>
                      ) : (
                        <button
                          onClick={handleCheckUpdates}
                          disabled={updateChecking || updateState.status === 'checking' || updateState.status === 'downloading'}
                          className={`flex-1 px-3 py-1.5 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg text-sm font-medium transition-colors disabled:opacity-50`}
                        >
                          {updateChecking ? 'Checking…' : updateState.status === 'downloading' ? 'Downloading…' : 'Check for updates'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={`p-3 ${tile} border rounded-lg`}>
                    <p className="font-medium text-sm">About</p>
                    <p className={`text-xs ${subtle} mt-1`}>Ink Flow v{appVersion} — Printer Maintenance Tracker</p>
                    <p className={`text-xs ${subtle} mt-0.5`}>Keeps liquid-ink printers healthy by tracking idle time and running scheduled maintenance prints.</p>
                  </div>
                </div>
              )}

              {tab === 'automation' && (
                <div className="space-y-3">
                  <div className={`p-3 ${tile} border rounded-lg`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">Auto Maintenance Print</p>
                        <p className={`text-xs ${subtle} mt-0.5`}>Automatically send a color test page when a printer is overdue</p>
                      </div>
                      <button onClick={handleAutoMaintenancePrintToggle} className={toggleBtnClass(autoMaintenancePrint)}>
                        <span className={toggleDotClass(autoMaintenancePrint)} />
                      </button>
                    </div>
                    {autoMaintenancePrint && maintenanceWindow && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <span className={`text-xs ${body}`}>Only between</span>
                        <select
                          value={maintenanceWindow.startHour}
                          onChange={(e) => handleWindowChange({ ...maintenanceWindow, startHour: parseInt(e.target.value) })}
                          className={`px-2 py-1 ${isDark ? 'bg-gray-700 text-gray-200 border-gray-600' : 'bg-white text-gray-800 border-gray-300'} border rounded text-xs`}
                        >
                          {Array.from({ length: 24 }, (_, h) => h).map(h => <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>)}
                        </select>
                        <span className={`text-xs ${body}`}>and</span>
                        <select
                          value={maintenanceWindow.endHour}
                          onChange={(e) => handleWindowChange({ ...maintenanceWindow, endHour: parseInt(e.target.value) })}
                          className={`px-2 py-1 ${isDark ? 'bg-gray-700 text-gray-200 border-gray-600' : 'bg-white text-gray-800 border-gray-300'} border rounded text-xs`}
                        >
                          {Array.from({ length: 25 }, (_, h) => h).map(h => <option key={h} value={h}>{h === 24 ? '24:00' : h.toString().padStart(2, '0') + ':00'}</option>)}
                        </select>
                        <span className={`text-xs ${subtle}`}>
                          {maintenanceWindow.startHour === 0 && maintenanceWindow.endHour === 24 ? '(any time)' : 'local time'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={`p-3 ${tile} border rounded-lg`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">Background Maintenance</p>
                        <p className={`text-xs ${subtle} mt-0.5`}>Check overdue printers on a schedule even when the app is closed</p>
                      </div>
                      <button
                        onClick={handleScheduleToggle}
                        disabled={schedulePending}
                        className={toggleBtnClass(!!schedule?.installed)}
                      >
                        <span className={toggleDotClass(!!schedule?.installed)} />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <span className={`text-xs ${body}`}>Run</span>
                      <select
                        value={tickInterval}
                        onChange={(e) => handleTickIntervalChange(parseInt(e.target.value))}
                        disabled={!schedule?.installed}
                        className={`px-2 py-1 ${isDark ? 'bg-gray-700 text-gray-200 border-gray-600' : 'bg-white text-gray-800 border-gray-300'} border rounded text-xs disabled:opacity-50`}
                      >
                        {TICK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    {schedule?.detail && <p className={`text-xs ${subtle} mt-2`}>{schedule.detail}</p>}
                    {scheduleResult && (
                      <p className={`text-xs mt-2 ${scheduleResult.success ? 'text-green-400' : 'text-red-400'}`}>
                        {scheduleResult.success
                          ? (lastScheduleOp === 'install' ? 'Background tick installed.' : 'Background tick removed.')
                          : (lastScheduleOp === 'install' ? `Couldn't install: ${scheduleResult.reason}` : scheduleResult.reason)}
                      </p>
                    )}
                  </div>

                  <div className={`p-3 ${tile} border rounded-lg`}>
                    <p className="font-medium text-sm mb-2">Alert escalation</p>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" /><span className={subtle}><span className="text-green-500 font-medium">Good</span> — plenty of time</span></div>
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500" /><span className={subtle}><span className="text-yellow-500 font-medium">Warning</span> — approaching</span></div>
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500" /><span className={subtle}><span className="text-orange-500 font-medium">Urgent</span> — &lt;1 day</span></div>
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /><span className={subtle}><span className="text-red-500 font-medium">Overdue</span> — past deadline</span></div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'detection' && (
                <div className="space-y-3">
                  {detection && (
                    <div className={`p-3 ${tile} border rounded-lg`}>
                      <p className="font-medium text-sm mb-2">Print Auto-Detection</p>
                      <div className="flex items-start gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${detection.available ? 'bg-green-500' : 'bg-red-500'}`} />
                        <p className={`text-xs ${body}`}>{detection.reason}</p>
                      </div>
                      {!detection.available && detection.fixable && (
                        <>
                          <button
                            onClick={handleEnableDetection}
                            disabled={fixing}
                            className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {fixing ? 'Requesting permission…' : (detection.actionHint || 'Enable auto-detection')}
                          </button>
                          {fixResult && (
                            <p className={`text-xs mt-2 ${fixResult.success ? 'text-green-400' : 'text-red-400'}`}>
                              {fixResult.success ? 'Enabled. Auto-detection is now active.' : fixResult.reason}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  <div className={`p-3 ${tile} border rounded-lg`}>
                    <p className={`text-xs ${subtle}`}>
                      <strong className={body}>How this works:</strong> When you print from any application, Ink Flow detects the job and automatically resets the maintenance timer for that printer. On Windows this requires the PrintService Operational log; on macOS and Linux it reads CUPS' page log.
                    </p>
                  </div>
                </div>
              )}

              {tab === 'backup' && (
                <div className="space-y-3">
                  <div className={`p-3 ${tile} border rounded-lg`}>
                    <p className="font-medium text-sm mb-2">Backup &amp; Restore</p>
                    <p className={`text-xs ${subtle} mb-3`}>Export all printer data and settings as JSON, or restore from a previously exported file.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleExport}
                        className={`flex-1 px-3 py-1.5 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg text-sm font-medium transition-colors`}
                      >
                        Export
                      </button>
                      <button
                        onClick={handleImport}
                        className={`flex-1 px-3 py-1.5 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg text-sm font-medium transition-colors`}
                      >
                        Import
                      </button>
                    </div>
                    {backupStatus && <p className={`text-xs mt-2 ${body}`}>{backupStatus}</p>}
                  </div>
                  <div className={`p-3 ${tile} border rounded-lg`}>
                    <p className={`text-xs ${subtle}`}>
                      <strong className={body}>Where data lives:</strong> Ink Flow stores everything in a single JSON file under your user-data directory. The backup is a snapshot of that file — useful before migrating to a new machine or as a safety net before major changes.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-3 border-t ${isDark ? 'border-gray-800' : 'border-gray-200'} flex justify-end`}>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg text-sm transition-colors`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
