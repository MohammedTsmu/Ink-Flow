import { describe, it, expect } from 'vitest';
import {
  isWithinMaintenanceWindow,
  isValidWindow,
  DEFAULT_MAINTENANCE_WINDOW,
} from '../maintenance-window';

function at(hour: number, minute = 0): Date {
  const d = new Date('2025-01-15T00:00:00');
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe('isWithinMaintenanceWindow', () => {
  it('default { 0, 24 } is always true', () => {
    for (let h = 0; h < 24; h++) {
      expect(isWithinMaintenanceWindow(DEFAULT_MAINTENANCE_WINDOW, at(h))).toBe(true);
    }
  });

  it('typical business-hours window allows midday and rejects midnight', () => {
    const w = { startHour: 9, endHour: 18 };
    expect(isWithinMaintenanceWindow(w, at(12))).toBe(true);
    expect(isWithinMaintenanceWindow(w, at(9))).toBe(true);
    expect(isWithinMaintenanceWindow(w, at(17, 59))).toBe(true);
    expect(isWithinMaintenanceWindow(w, at(18))).toBe(false);
    expect(isWithinMaintenanceWindow(w, at(0))).toBe(false);
    expect(isWithinMaintenanceWindow(w, at(8, 59))).toBe(false);
  });

  it('overnight window (22..6) wraps midnight', () => {
    const w = { startHour: 22, endHour: 6 };
    expect(isWithinMaintenanceWindow(w, at(23))).toBe(true);
    expect(isWithinMaintenanceWindow(w, at(0))).toBe(true);
    expect(isWithinMaintenanceWindow(w, at(5, 59))).toBe(true);
    expect(isWithinMaintenanceWindow(w, at(6))).toBe(false);
    expect(isWithinMaintenanceWindow(w, at(12))).toBe(false);
    expect(isWithinMaintenanceWindow(w, at(21, 59))).toBe(false);
  });

  it('window where start==end (and not 0/24) never matches', () => {
    const w = { startHour: 9, endHour: 9 };
    for (let h = 0; h < 24; h++) {
      expect(isWithinMaintenanceWindow(w, at(h))).toBe(false);
    }
  });
});

describe('isValidWindow', () => {
  it('accepts the default and typical windows', () => {
    expect(isValidWindow({ startHour: 0, endHour: 24 })).toBe(true);
    expect(isValidWindow({ startHour: 9, endHour: 18 })).toBe(true);
    expect(isValidWindow({ startHour: 22, endHour: 6 })).toBe(true);
  });

  it('rejects out-of-range hours', () => {
    expect(isValidWindow({ startHour: -1, endHour: 12 })).toBe(false);
    expect(isValidWindow({ startHour: 0, endHour: 25 })).toBe(false);
    expect(isValidWindow({ startHour: 24, endHour: 24 })).toBe(false);
  });

  it('rejects non-integer hours', () => {
    expect(isValidWindow({ startHour: 9.5, endHour: 18 })).toBe(false);
  });
});
