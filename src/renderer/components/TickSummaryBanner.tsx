import React, { useEffect, useState } from 'react';
import { useTheme } from '../ThemeContext';
import { TickSummary } from '../types';

/**
 * Surfaces a one-line recap of what the headless tick did since the
 * user last opened the app. Auto-dismisses after the user
 * acknowledges (markSummarySeen advances the cursor on the main side).
 */
export default function TickSummaryBanner() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [summary, setSummary] = useState<TickSummary | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.api.getTickSummary().then(s => { if (!cancelled) setSummary(s); });
    return () => { cancelled = true; };
  }, []);

  const dismiss = async () => {
    setDismissed(true);
    try { await window.api.markSummarySeen(); } catch { /* ignore */ }
  };

  if (!summary || dismissed) return null;

  const parts: string[] = [];
  if (summary.ticksRan > 0) parts.push(`${summary.ticksRan} tick run${summary.ticksRan === 1 ? '' : 's'}`);
  if (summary.prints > 0) {
    const names = summary.printersServed.length > 0 ? ` (${summary.printersServed.join(', ')})` : '';
    parts.push(`${summary.prints} maintenance print${summary.prints === 1 ? '' : 's'}${names}`);
  }
  if (summary.offlineSkips > 0) parts.push(`${summary.offlineSkips} offline skip${summary.offlineSkips === 1 ? '' : 's'}`);
  if (summary.failures > 0) parts.push(`${summary.failures} failure${summary.failures === 1 ? '' : 's'}`);

  const message = parts.length > 0
    ? `While you were away: ${parts.join(', ')}.`
    : 'Background tick ran while you were away.';

  const hasFailures = summary.failures > 0;

  return (
    <div className={`${
      hasFailures
        ? (isDark ? 'bg-red-950/50 border-red-900' : 'bg-red-50 border-red-200')
        : (isDark ? 'bg-blue-950/50 border-blue-900' : 'bg-blue-50 border-blue-200')
    } border rounded-xl px-4 py-3 mb-4 flex items-center gap-3`}>
      <span className="text-lg shrink-0">{hasFailures ? '⚠️' : '✓'}</span>
      <p className={`flex-1 text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{message}</p>
      <button
        onClick={dismiss}
        className={`px-2 py-1 text-xs ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
        title="Dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
