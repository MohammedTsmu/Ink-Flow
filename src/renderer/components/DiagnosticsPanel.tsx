import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../ThemeContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { DiagnosticEntry } from '../types';

interface DiagnosticsPanelProps {
  onClose: () => void;
}

type LevelFilter = 'all' | 'info' | 'warn' | 'error';

const LEVEL_STYLES: Record<DiagnosticEntry['level'], { bg: string; text: string; dot: string; label: string }> = {
  info:  { bg: 'bg-blue-500/10',   text: 'text-blue-400',   dot: 'bg-blue-500',   label: 'INFO' },
  warn:  { bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-500', label: 'WARN' },
  error: { bg: 'bg-red-500/10',    text: 'text-red-400',    dot: 'bg-red-500',    label: 'ERROR' },
};

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default function DiagnosticsPanel({ onClose }: DiagnosticsPanelProps) {
  useEscapeKey(onClose);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LevelFilter>('all');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = async () => {
    try {
      const fresh = await window.api.getDiagnostics(200);
      setEntries(fresh);
    } catch {
      // The IPC call rarely fails; if it does, leave the list as-is.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (!autoRefresh) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filtered = useMemo(() => {
    let result = entries;
    if (filter !== 'all') result = result.filter(e => e.level === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.message.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q),
      );
    }
    return result;
  }, [entries, filter, search]);

  const counts = useMemo(() => ({
    all: entries.length,
    info: entries.filter(e => e.level === 'info').length,
    warn: entries.filter(e => e.level === 'warn').length,
    error: entries.filter(e => e.level === 'error').length,
  }), [entries]);

  const filterBtn = (level: LevelFilter, label: string, badge: number, color: string) => (
    <button
      onClick={() => setFilter(level)}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        filter === level
          ? `${color} ring-2 ring-offset-0 ${isDark ? 'ring-gray-600' : 'ring-gray-300'}`
          : isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
      }`}
    >
      {label} <span className="opacity-70">{badge}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xl font-bold">Diagnostics</h2>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>
                Latest activity log entries (tick runs, prints, failures).
              </p>
            </div>
            <button
              onClick={onClose}
              className={`px-3 py-1.5 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg text-sm transition-colors`}
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filterBtn('all', 'All', counts.all, 'bg-gray-600 text-white')}
            {filterBtn('info', 'Info', counts.info, 'bg-blue-600 text-white')}
            {filterBtn('warn', 'Warnings', counts.warn, 'bg-yellow-600 text-white')}
            {filterBtn('error', 'Errors', counts.error, 'bg-red-600 text-white')}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by message or source…"
              className={`flex-1 min-w-[200px] px-3 py-1 rounded-lg text-sm ${isDark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-gray-100 border-gray-200 text-gray-800'} border`}
            />
            <label className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} cursor-pointer`}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-blue-500"
              />
              Auto-refresh
            </label>
            <button
              onClick={load}
              className={`px-3 py-1 ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} rounded-lg text-sm transition-colors`}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm`}>
                {entries.length === 0
                  ? 'No diagnostic entries yet. Ink Flow logs every important event here.'
                  : 'No entries match the current filter.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((e, idx) => {
                const s = LEVEL_STYLES[e.level];
                return (
                  <li key={`${e.ts}-${idx}`} className={`${s.bg} border ${isDark ? 'border-gray-800' : 'border-gray-200'} rounded-lg p-3`}>
                    <div className="flex items-start gap-3">
                      <span className={`w-2 h-2 rounded-full ${s.dot} mt-1.5 shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase ${s.text}`}>{s.label}</span>
                          <span className={`text-[10px] font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{e.source}</span>
                          <span className={`text-[10px] ${isDark ? 'text-gray-600' : 'text-gray-400'} ml-auto`}>{relativeTime(e.ts)}</span>
                        </div>
                        <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{e.message}</p>
                        {e.detail !== undefined && (
                          <pre className={`text-[11px] font-mono ${isDark ? 'text-gray-500 bg-black/30' : 'text-gray-500 bg-gray-50'} rounded p-2 mt-2 overflow-x-auto`}>
{typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
