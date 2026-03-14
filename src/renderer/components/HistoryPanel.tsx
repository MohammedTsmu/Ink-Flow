import React, { useState, useEffect } from 'react';
import { MaintenanceEventWithPrinter } from '../types';
import { useTheme } from '../ThemeContext';

interface HistoryPanelProps {
  printerId?: number;
  onClose: () => void;
}

export default function HistoryPanel({ printerId, onClose }: HistoryPanelProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [events, setEvents] = useState<MaintenanceEventWithPrinter[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'print' | 'clean'>('all');

  useEffect(() => {
    loadEvents();
  }, [printerId]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const allEvents = await window.api.getAllEvents();
      const filtered = printerId
        ? allEvents.filter(e => e.printerId === printerId)
        : allEvents;
      setEvents(filtered);
    } finally {
      setLoading(false);
    }
  };

  const displayEvents = filter === 'all' ? events : events.filter(e => e.eventType === filter);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl w-full max-w-2xl max-h-[80vh] shadow-2xl flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <h2 className="text-xl font-bold">Maintenance History</h2>
          <button onClick={onClose} className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-5 pt-4">
          {(['all', 'print', 'clean'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : `${isDark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`
              }`}
            >
              {f === 'all' ? 'All' : f === 'print' ? 'Prints' : 'Cleans'}
            </button>
          ))}
          <span className={`ml-auto text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'} self-center`}>
            {displayEvents.length} event{displayEvents.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Event list */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className={`text-center ${isDark ? 'text-gray-500' : 'text-gray-400'} py-8`}>Loading...</p>
          ) : displayEvents.length === 0 ? (
            <p className={`text-center ${isDark ? 'text-gray-500' : 'text-gray-400'} py-8`}>No maintenance events recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {displayEvents.map((event) => (
                <div key={event.id} className={`flex items-center gap-3 p-3 ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'} rounded-lg`}>
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{event.printerName}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        event.eventType === 'print' ? 'bg-blue-600/20 text-blue-400' : 'bg-purple-600/20 text-purple-400'
                      }`}>
                        {event.eventType === 'print' ? 'Printed' : 'Cleaned'}
                      </span>
                    </div>
                    {event.notes && (
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} truncate mt-0.5`}>{event.notes}</p>
                    )}
                  </div>

                  {/* Date */}
                  <div className="text-right shrink-0">
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {new Date(event.eventDate).toLocaleDateString()}
                    </p>
                    <p className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      {new Date(event.eventDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
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
