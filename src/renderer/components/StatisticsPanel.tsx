import React, { useState, useEffect } from 'react';
import { Statistics } from '../types';
import { useTheme } from '../ThemeContext';

interface StatisticsPanelProps {
  onClose: () => void;
}

export default function StatisticsPanel({ onClose }: StatisticsPanelProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await window.api.getStatistics();
      setStats(data);
    } finally {
      setLoading(false);
    }
  };

  const maxDailyTotal = stats
    ? Math.max(1, ...stats.daily.map(d => d.prints + d.cleans))
    : 1;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border rounded-xl w-full max-w-3xl max-h-[85vh] shadow-2xl flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-5 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          <h2 className="text-xl font-bold">Statistics</h2>
          <button onClick={onClose} className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading || !stats ? (
            <p className={`text-center ${isDark ? 'text-gray-500' : 'text-gray-400'} py-8`}>Loading statistics...</p>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg p-4 text-center`}>
                  <p className="text-3xl font-bold text-blue-400">{stats.totalPrinters}</p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>Printers Tracked</p>
                </div>
                <div className={`${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg p-4 text-center`}>
                  <p className="text-3xl font-bold text-purple-400">{stats.totalEvents}</p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} mt-1`}>Total Events</p>
                </div>
              </div>

              {/* 30 day activity chart */}
              <div>
                <h3 className={`font-semibold text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Last 30 Days Activity</h3>
                <div className={`${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg p-4`}>
                  {stats.daily.length === 0 ? (
                    <p className={`text-center ${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm`}>No activity yet.</p>
                  ) : (
                    <div className="flex items-end gap-[2px] h-32">
                      {stats.daily.map((day) => {
                        const total = day.prints + day.cleans;
                        const height = total > 0 ? Math.max(4, (total / maxDailyTotal) * 100) : 0;
                        const printHeight = total > 0 ? (day.prints / total) * height : 0;
                        const cleanHeight = height - printHeight;
                        return (
                          <div
                            key={day.date}
                            className="flex-1 flex flex-col justify-end group relative"
                            style={{ minWidth: 0 }}
                          >
                            {/* Tooltip */}
                            <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 ${isDark ? 'bg-gray-700' : 'bg-gray-800'} text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10`}>
                              <p className="font-medium">{day.date}</p>
                              <p>Prints: {day.prints} | Cleans: {day.cleans}</p>
                            </div>
                            {total > 0 ? (
                              <>
                                <div
                                  className="bg-purple-500 rounded-t-sm w-full"
                                  style={{ height: `${cleanHeight}%` }}
                                />
                                <div
                                  className="bg-blue-500 w-full"
                                  style={{ height: `${printHeight}%` }}
                                />
                              </>
                            ) : (
                              <div className={`${isDark ? 'bg-gray-700/30' : 'bg-gray-300/50'} w-full h-1 rounded-sm`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className={`flex justify-between text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'} mt-2`}>
                    <span>{stats.daily.length > 0 ? stats.daily[0].date : ''}</span>
                    <div className="flex gap-3">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-sm"></span> Prints
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-purple-500 rounded-sm"></span> Cleans
                      </span>
                    </div>
                    <span>{stats.daily.length > 0 ? stats.daily[stats.daily.length - 1].date : ''}</span>
                  </div>
                </div>
              </div>

              {/* Per-printer breakdown */}
              <div>
                <h3 className={`font-semibold text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Per Printer</h3>
                {stats.perPrinter.length === 0 ? (
                  <p className={`text-center ${isDark ? 'text-gray-500' : 'text-gray-400'} text-sm`}>No printers tracked yet.</p>
                ) : (
                  <div className="space-y-2">
                    {stats.perPrinter
                      .sort((a, b) => b.totalEvents - a.totalEvents)
                      .map((p) => {
                        const maxEvents = Math.max(1, ...stats.perPrinter.map(x => x.totalEvents));
                        const barWidth = (p.totalEvents / maxEvents) * 100;
                        return (
                          <div key={p.printerId} className={`${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded-lg p-3`}>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="font-medium text-sm truncate">{p.printerName}</span>
                              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'} shrink-0 ml-2`}>
                                {p.totalEvents} event{p.totalEvents !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className={`w-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'} rounded-full h-2`}>
                              <div className="h-2 rounded-full flex overflow-hidden" style={{ width: `${barWidth}%` }}>
                                {p.prints > 0 && (
                                  <div
                                    className="bg-blue-500 h-full"
                                    style={{ width: `${(p.prints / p.totalEvents) * 100}%` }}
                                  />
                                )}
                                {p.cleans > 0 && (
                                  <div
                                    className="bg-purple-500 h-full"
                                    style={{ width: `${(p.cleans / p.totalEvents) * 100}%` }}
                                  />
                                )}
                              </div>
                            </div>
                            <div className={`flex gap-3 mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              <span>{p.prints} print{p.prints !== 1 ? 's' : ''}</span>
                              <span>{p.cleans} clean{p.cleans !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
