import { describe, it, expect } from 'vitest';
import { shouldAlert, shouldFireAutoPrintNotification, DEFAULT_ALERT_COOLDOWN_MS } from '../alert-throttle';
import { PrinterRecord } from '../types';

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date('2025-01-15T12:00:00Z').getTime();

function p(overrides: Partial<PrinterRecord> = {}): PrinterRecord {
  return {
    id: 1, name: 'HP', model: '', inkType: '',
    maxIdleDays: 7, warningDays: 2, autoMaintain: true,
    createdAt: '', updatedAt: '',
    ...overrides,
  };
}

describe('shouldAlert', () => {
  it('alerts on first ever encounter (no lastAlertedAt)', () => {
    expect(shouldAlert(p(), 'warning', NOW)).toBe(true);
  });

  it('alerts on escalation regardless of recency', () => {
    const printer = p({
      lastAlertedAt: new Date(NOW - 5 * 60 * 1000).toISOString(),  // 5 min ago
      lastAlertedLevel: 'warning',
    });
    expect(shouldAlert(printer, 'overdue', NOW)).toBe(true);
    expect(shouldAlert(printer, 'critical', NOW)).toBe(true);
  });

  it('throttles same level within cooldown', () => {
    const printer = p({
      lastAlertedAt: new Date(NOW - 2 * HOUR_MS).toISOString(),
      lastAlertedLevel: 'urgent',
    });
    expect(shouldAlert(printer, 'urgent', NOW)).toBe(false);
  });

  it('alerts again after cooldown elapses at same level', () => {
    const printer = p({
      lastAlertedAt: new Date(NOW - 25 * HOUR_MS).toISOString(),
      lastAlertedLevel: 'urgent',
    });
    expect(shouldAlert(printer, 'urgent', NOW)).toBe(true);
  });

  it('throttles de-escalation (overdue → warning) until cooldown', () => {
    const printer = p({
      lastAlertedAt: new Date(NOW - 2 * HOUR_MS).toISOString(),
      lastAlertedLevel: 'overdue',
    });
    expect(shouldAlert(printer, 'warning', NOW)).toBe(false);
  });

  it('honours a custom cooldown', () => {
    const printer = p({
      lastAlertedAt: new Date(NOW - 2 * HOUR_MS).toISOString(),
      lastAlertedLevel: 'warning',
    });
    expect(shouldAlert(printer, 'warning', NOW, HOUR_MS)).toBe(true);
    expect(shouldAlert(printer, 'warning', NOW, 4 * HOUR_MS)).toBe(false);
  });
});

describe('shouldFireAutoPrintNotification', () => {
  it('fires on first ever auto-print', () => {
    expect(shouldFireAutoPrintNotification(p(), NOW)).toBe(true);
  });

  it('throttles within 6h', () => {
    const printer = p({ lastAutoPrintNotifiedAt: new Date(NOW - 3 * HOUR_MS).toISOString() });
    expect(shouldFireAutoPrintNotification(printer, NOW)).toBe(false);
  });

  it('fires again after 6h', () => {
    const printer = p({ lastAutoPrintNotifiedAt: new Date(NOW - 7 * HOUR_MS).toISOString() });
    expect(shouldFireAutoPrintNotification(printer, NOW)).toBe(true);
  });
});
