import React from 'react';
import { useTheme } from '../ThemeContext';
import { AlertItem } from '../types';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface AlertModalProps {
  alerts: AlertItem[];
  onDismiss: () => void;
}

const levelConfig: Record<string, { icon: string; color: string; bg: string; border: string; pulse: boolean }> = {
  critical: { icon: '🚨', color: 'text-red-400', bg: 'bg-red-950', border: 'border-red-600', pulse: true },
  severe:   { icon: '🔥', color: 'text-red-400', bg: 'bg-red-950', border: 'border-red-700', pulse: true },
  overdue:  { icon: '⛔', color: 'text-red-400', bg: 'bg-red-950/80', border: 'border-red-800', pulse: false },
  urgent:   { icon: '🔴', color: 'text-orange-400', bg: 'bg-orange-950', border: 'border-orange-700', pulse: false },
  warning:  { icon: '⚠️', color: 'text-yellow-400', bg: 'bg-yellow-950', border: 'border-yellow-700', pulse: false },
};

const levelConfigLight: Record<string, { bg: string; border: string }> = {
  critical: { bg: 'bg-red-50', border: 'border-red-400' },
  severe:   { bg: 'bg-red-50', border: 'border-red-400' },
  overdue:  { bg: 'bg-red-50', border: 'border-red-300' },
  urgent:   { bg: 'bg-orange-50', border: 'border-orange-300' },
  warning:  { bg: 'bg-yellow-50', border: 'border-yellow-300' },
};

const levelPriority: Record<string, number> = {
  critical: 0,
  severe: 1,
  overdue: 2,
  urgent: 3,
  warning: 4,
};

export default function AlertModal({ alerts, onDismiss }: AlertModalProps) {
  useEscapeKey(onDismiss);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Sort by severity
  const sorted = [...alerts].sort((a, b) => (levelPriority[a.level] ?? 5) - (levelPriority[b.level] ?? 5));
  const worstLevel = sorted[0]?.level || 'warning';
  const hasCritical = worstLevel === 'critical' || worstLevel === 'severe';

  const headerBg = hasCritical
    ? (isDark ? 'bg-red-900' : 'bg-red-600')
    : worstLevel === 'overdue' || worstLevel === 'urgent'
      ? (isDark ? 'bg-orange-900' : 'bg-orange-500')
      : (isDark ? 'bg-yellow-900' : 'bg-yellow-500');

  const headerText = hasCritical
    ? 'text-white'
    : worstLevel === 'overdue' || worstLevel === 'urgent'
      ? 'text-white'
      : (isDark ? 'text-yellow-100' : 'text-white');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop with pulsing red tint for critical alerts */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm ${hasCritical ? 'animate-pulse-slow' : ''}`}
        onClick={onDismiss}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-xl mx-4 rounded-2xl shadow-2xl overflow-hidden ${
          isDark ? 'bg-gray-900' : 'bg-white'
        } ${hasCritical ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-transparent' : ''}`}
      >
        {/* Header */}
        <div className={`${headerBg} px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{hasCritical ? '🚨' : worstLevel === 'urgent' || worstLevel === 'overdue' ? '🔴' : '⚠️'}</span>
              <div>
                <h2 className={`text-lg font-bold ${headerText}`}>
                  {hasCritical ? 'CRITICAL PRINTER ALERT' : worstLevel === 'urgent' || worstLevel === 'overdue' ? 'Printer Alert' : 'Printer Maintenance Reminder'}
                </h2>
                <p className={`text-sm ${headerText} opacity-80`}>
                  {alerts.length} printer{alerts.length > 1 ? 's need' : ' needs'} your attention
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Alert list */}
        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto space-y-3">
          {sorted.map((alert, i) => {
            const cfg = levelConfig[alert.level] || levelConfig.warning;
            const cfgLight = levelConfigLight[alert.level] || levelConfigLight.warning;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 ${
                  isDark ? `${cfg.bg} ${cfg.border}` : `${cfgLight.bg} ${cfgLight.border}`
                } ${cfg.pulse ? 'animate-pulse-subtle' : ''}`}
              >
                <span className="text-2xl shrink-0 mt-0.5">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-bold text-base ${cfg.color}`}>{alert.name}</h3>
                    <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${
                      isDark ? 'bg-white/10' : 'bg-black/10'
                    } ${cfg.color}`}>
                      {alert.level}
                    </span>
                  </div>
                  <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {alert.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 ${isDark ? 'bg-gray-800/50 border-gray-800' : 'bg-gray-50 border-gray-200'} border-t`}>
          <div className="flex items-center justify-between">
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {hasCritical
                ? 'Turn on your printer(s) and run a cleaning cycle immediately!'
                : 'Take action to prevent nozzle clogging.'}
            </p>
            <button
              onClick={onDismiss}
              className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                hasCritical
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : worstLevel === 'urgent' || worstLevel === 'overdue'
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
              }`}
            >
              I understand
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { background-color: rgba(0,0,0,0.7); }
          50% { background-color: rgba(127,29,29,0.5); }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
