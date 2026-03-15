import React, { useState, useEffect, useMemo } from 'react';
import { MaintenanceEventWithPrinter, Printer } from '../types';
import { useTheme } from '../ThemeContext';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface HistoryPanelProps {
  printerId?: number;
  onClose: () => void;
}

type DateRange = 'today' | '7d' | '30d' | '90d' | 'all';

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

function dateKey(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function detectSource(notes: string): { label: string; color: string; bg: string } {
  const n = notes.toLowerCase();
  if (n.includes('auto-detected') || n.includes('detected from'))
    return { label: 'Auto-detected', color: 'text-green-400', bg: 'bg-green-600/20' };
  if (n.includes('auto maintenance') || n.includes('automatic'))
    return { label: 'Auto-maintenance', color: 'text-cyan-400', bg: 'bg-cyan-600/20' };
  if (n.includes('test print') || n.includes('manual test'))
    return { label: 'Test print', color: 'text-amber-400', bg: 'bg-amber-600/20' };
  return { label: 'Manual', color: 'text-gray-400', bg: 'bg-gray-600/20' };
}

export default function HistoryPanel({ printerId, onClose }: HistoryPanelProps) {
  useEscapeKey(onClose);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [events, setEvents] = useState<MaintenanceEventWithPrinter[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'print' | 'clean'>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [printerFilter, setPrinterFilter] = useState<number | 'all'>(printerId ?? 'all');
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copiedCSV, setCopiedCSV] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allEvents, allPrinters] = await Promise.all([
        window.api.getAllEvents(),
        window.api.getPrinters(),
      ]);
      setEvents(allEvents);
      setPrinters(allPrinters);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    let result = events;

    // Printer filter
    if (printerFilter !== 'all') {
      result = result.filter(e => e.printerId === printerFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(e => e.eventType === typeFilter);
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = Date.now();
      const msMap: Record<string, number> = { today: 86400000, '7d': 604800000, '30d': 2592000000, '90d': 7776000000 };
      const cutoff = now - msMap[dateRange];
      result = result.filter(e => new Date(e.eventDate).getTime() >= cutoff);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.printerName.toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q) ||
        e.eventType.toLowerCase().includes(q)
      );
    }

    return result;
  }, [events, printerFilter, typeFilter, dateRange, search]);

  // Group by date
  const groupedEvents = useMemo(() => {
    const groups: { key: string; events: MaintenanceEventWithPrinter[] }[] = [];
    const map = new Map<string, MaintenanceEventWithPrinter[]>();
    for (const e of filteredEvents) {
      const dk = dateKey(e.eventDate);
      if (!map.has(dk)) {
        const arr: MaintenanceEventWithPrinter[] = [];
        map.set(dk, arr);
        groups.push({ key: dk, events: arr });
      }
      map.get(dk)!.push(e);
    }
    return groups;
  }, [filteredEvents]);

  // Summary stats
  const stats = useMemo(() => {
    const prints = filteredEvents.filter(e => e.eventType === 'print').length;
    const cleans = filteredEvents.filter(e => e.eventType === 'clean').length;
    const autoDetected = filteredEvents.filter(e => e.notes.toLowerCase().includes('auto-detected') || e.notes.toLowerCase().includes('detected from')).length;
    return { total: filteredEvents.length, prints, cleans, autoDetected };
  }, [filteredEvents]);

  const handleDelete = async (eventId: number) => {
    if (deletingId === eventId) {
      await window.api.deleteEvent(eventId);
      setEvents(prev => prev.filter(e => e.id !== eventId));
      setDeletingId(null);
    } else {
      setDeletingId(eventId);
      setTimeout(() => setDeletingId(prev => prev === eventId ? null : prev), 3000);
    }
  };

  const handleExportCSV = () => {
    const header = 'Date,Time,Printer,Type,Source,Notes';
    const rows = filteredEvents.map(e => {
      const d = new Date(e.eventDate);
      const date = d.toLocaleDateString();
      const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const type = e.eventType === 'print' ? 'Printed' : 'Cleaned';
      const source = detectSource(e.notes).label;
      const notes = e.notes.replace(/"/g, '""');
      return `${date},${time},"${e.printerName}",${type},${source},"${notes}"`;
    });
    navigator.clipboard.writeText([header, ...rows].join('\n'));
    setCopiedCSV(true);
    setTimeout(() => setCopiedCSV(false), 2000);
  };

  const pill = (active: boolean) =>
    active
      ? 'bg-blue-600 text-white'
      : isDark
        ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        : 'bg-gray-100 text-gray-500 hover:bg-gray-200';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl w-full max-w-3xl max-h-[85vh] shadow-2xl flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <div>
            <h2 className="text-xl font-bold">Maintenance History</h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Track all printing and cleaning activity
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                copiedCSV
                  ? 'bg-green-600/20 text-green-400'
                  : isDark
                    ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              title="Copy history as CSV to clipboard"
            >
              {copiedCSV ? '✓ Copied!' : '📋 Export CSV'}
            </button>
            <button onClick={onClose} className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className={`grid grid-cols-4 gap-3 px-5 pt-4`}>
          {[
            { label: 'Total', value: stats.total, icon: '📊', color: 'text-blue-400' },
            { label: 'Prints', value: stats.prints, icon: '🖨️', color: 'text-blue-400' },
            { label: 'Cleans', value: stats.cleans, icon: '🧹', color: 'text-purple-400' },
            { label: 'Auto-detected', value: stats.autoDetected, icon: '⚡', color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className={`${isDark ? 'bg-gray-800/50' : 'bg-gray-50'} rounded-lg p-2.5 text-center`}>
              <p className="text-lg">{s.icon}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters row */}
        <div className="px-5 pt-3 flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <svg className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-lg text-sm ${
                isDark ? 'bg-gray-800 text-white placeholder-gray-500 border-gray-700' : 'bg-gray-50 text-gray-900 placeholder-gray-400 border-gray-200'
              } border focus:outline-none focus:ring-1 focus:ring-blue-500`}
            />
          </div>

          {/* Printer dropdown */}
          <select
            value={printerFilter === 'all' ? 'all' : printerFilter}
            onChange={(e) => setPrinterFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              isDark ? 'bg-gray-800 text-white border-gray-700' : 'bg-gray-50 text-gray-900 border-gray-200'
            } focus:outline-none focus:ring-1 focus:ring-blue-500`}
          >
            <option value="all">All printers</option>
            {printers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Type + Date filters */}
        <div className="px-5 pt-2 pb-1 flex flex-wrap gap-2 items-center">
          {/* Type pills */}
          {(['all', 'print', 'clean'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${pill(typeFilter === f)}`}
            >
              {f === 'all' ? 'All types' : f === 'print' ? '🖨️ Prints' : '🧹 Cleans'}
            </button>
          ))}

          <span className={`mx-1 ${isDark ? 'text-gray-700' : 'text-gray-300'}`}>|</span>

          {/* Date range pills */}
          {([
            ['today', 'Today'],
            ['7d', '7 days'],
            ['30d', '30 days'],
            ['90d', '90 days'],
            ['all', 'All time'],
          ] as [DateRange, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDateRange(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${pill(dateRange === key)}`}
            >
              {label}
            </button>
          ))}

          <span className={`ml-auto text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} self-center`}>
            {filteredEvents.length} result{filteredEvents.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Event list - grouped by date */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">
          {loading ? (
            <p className={`text-center ${isDark ? 'text-gray-500' : 'text-gray-400'} py-12`}>Loading...</p>
          ) : groupedEvents.length === 0 ? (
            <div className={`text-center py-12`}>
              <p className="text-3xl mb-2">📭</p>
              <p className={`${isDark ? 'text-gray-500' : 'text-gray-400'} font-medium`}>No events found</p>
              <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'} mt-1`}>
                {search || typeFilter !== 'all' || dateRange !== 'all' || printerFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Maintenance events will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedEvents.map((group) => (
                <div key={group.key}>
                  {/* Date header */}
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {group.key}
                    </h3>
                    <div className={`flex-1 h-px ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                    <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      {group.events.length}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {group.events.map((event) => {
                      const source = detectSource(event.notes);
                      return (
                        <div
                          key={event.id}
                          className={`group flex items-center gap-3 p-3 ${isDark ? 'bg-gray-800/50 hover:bg-gray-800' : 'bg-gray-50 hover:bg-gray-100'} rounded-lg transition-colors`}
                        >
                          {/* Type icon */}
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            event.eventType === 'print' ? 'bg-blue-600/20 text-blue-400' : 'bg-purple-600/20 text-purple-400'
                          }`}>
                            {event.eventType === 'print' ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                              </svg>
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{event.printerName}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                event.eventType === 'print' ? 'bg-blue-600/20 text-blue-400' : 'bg-purple-600/20 text-purple-400'
                              }`}>
                                {event.eventType === 'print' ? 'Printed' : 'Cleaned'}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${source.bg} ${source.color}`}>
                                {source.label}
                              </span>
                            </div>
                            {event.notes && (
                              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} truncate mt-0.5`}>{event.notes}</p>
                            )}
                          </div>

                          {/* Time + delete */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {new Date(event.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                {relativeTime(event.eventDate)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDelete(event.id)}
                              className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-md transition-all ${
                                deletingId === event.id
                                  ? 'opacity-100 bg-red-600/20 text-red-400'
                                  : isDark
                                    ? 'hover:bg-gray-700 text-gray-500 hover:text-red-400'
                                    : 'hover:bg-gray-200 text-gray-400 hover:text-red-500'
                              }`}
                              title={deletingId === event.id ? 'Click again to confirm delete' : 'Delete event'}
                            >
                              {deletingId === event.id ? (
                                <span className="text-xs font-medium">Confirm?</span>
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
