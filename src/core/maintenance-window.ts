import { MaintenanceWindow } from './types';

export const DEFAULT_MAINTENANCE_WINDOW: MaintenanceWindow = { startHour: 0, endHour: 24 };

/**
 * Returns true when `now` falls inside the maintenance window.
 *
 *   { 0, 24 }   → always (the documented "anytime" encoding)
 *   { 9, 18 }   → 09:00 – 17:59 local time
 *   { 22, 6 }   → 22:00 – 05:59 local time (wraps midnight)
 *   start == end (and not 0/24) → empty window, never matches
 */
export function isWithinMaintenanceWindow(
  window: MaintenanceWindow,
  now: Date = new Date(),
): boolean {
  if (window.startHour === 0 && window.endHour === 24) return true;
  if (window.startHour === window.endHour) return false;

  const hour = now.getHours();
  if (window.startHour < window.endHour) {
    return hour >= window.startHour && hour < window.endHour;
  }
  // Wraps midnight
  return hour >= window.startHour || hour < window.endHour;
}

export function isValidWindow(w: MaintenanceWindow): boolean {
  return (
    Number.isInteger(w.startHour) &&
    Number.isInteger(w.endHour) &&
    w.startHour >= 0 && w.startHour <= 23 &&
    w.endHour >= 0 && w.endHour <= 24
  );
}
