import { describe, it, expect } from 'vitest';
import { calculateStatus } from '../status';
import { EventRecord } from '../types';

const ONE_DAY_MS = 1000 * 60 * 60 * 24;
const NOW = new Date('2025-01-15T12:00:00Z').getTime();

function eventNDaysAgo(days: number): EventRecord {
  return {
    id: 1,
    printerId: 1,
    eventType: 'print',
    eventDate: new Date(NOW - days * ONE_DAY_MS).toISOString(),
    notes: '',
  };
}

describe('calculateStatus', () => {
  it('returns overdue with 0 days remaining when no last event', () => {
    const result = calculateStatus(null, 7, 2, NOW);
    expect(result.status).toBe('overdue');
    expect(result.daysRemaining).toBe(0);
  });

  it('returns good when the printer was used recently', () => {
    const result = calculateStatus(eventNDaysAgo(1), 7, 2, NOW);
    expect(result.status).toBe('good');
    expect(result.daysRemaining).toBe(6);
  });

  it('returns warning at the warningDays boundary', () => {
    const result = calculateStatus(eventNDaysAgo(5), 7, 2, NOW);
    expect(result.status).toBe('warning');
    expect(result.daysRemaining).toBe(2);
  });

  it('returns urgent when less than one day remains', () => {
    const result = calculateStatus(eventNDaysAgo(6.5), 7, 2, NOW);
    expect(result.status).toBe('urgent');
    expect(result.daysRemaining).toBeLessThanOrEqual(1);
    expect(result.daysRemaining).toBeGreaterThan(0);
  });

  it('returns overdue once max idle days have passed', () => {
    const result = calculateStatus(eventNDaysAgo(8), 7, 2, NOW);
    expect(result.status).toBe('overdue');
    expect(result.daysRemaining).toBeLessThan(0);
  });

  it('rounds daysRemaining to one decimal', () => {
    const result = calculateStatus(eventNDaysAgo(3.456), 7, 2, NOW);
    expect(result.daysRemaining * 10).toBeCloseTo(Math.round(result.daysRemaining * 10), 10);
  });

  it('treats the threshold (remaining=0) as overdue, not urgent', () => {
    const result = calculateStatus(eventNDaysAgo(7), 7, 2, NOW);
    expect(result.status).toBe('overdue');
  });
});
