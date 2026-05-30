import { describe, it, expect } from 'vitest';
import { computeAlert } from '../severity';

describe('computeAlert', () => {
  it('returns null for a healthy printer', () => {
    expect(computeAlert('good', 5, 7)).toBeNull();
  });

  it('produces a warning alert when in the warning window', () => {
    const alert = computeAlert('warning', 2, 7);
    expect(alert?.level).toBe('warning');
    expect(alert?.message).toMatch(/2 day/);
  });

  it('produces an urgent alert for the urgent state', () => {
    const alert = computeAlert('urgent', 0.5, 7);
    expect(alert?.level).toBe('urgent');
    expect(alert?.message).toMatch(/Less than 1 day/);
  });

  it('produces an overdue alert for a freshly overdue printer', () => {
    const alert = computeAlert('overdue', -2, 7);
    expect(alert?.level).toBe('overdue');
    expect(alert?.message).toMatch(/2 day/);
  });

  it('escalates to severe at or past one full max-idle period overdue', () => {
    const alert = computeAlert('overdue', -7, 7);
    expect(alert?.level).toBe('severe');
  });

  it('escalates to critical at or past two full max-idle periods overdue', () => {
    const alert = computeAlert('overdue', -14, 7);
    expect(alert?.level).toBe('critical');
  });

  it('uses the absolute value of daysRemaining for overdue messages', () => {
    const alert = computeAlert('overdue', -3.4, 7);
    expect(alert?.message).toMatch(/3\.4/);
  });
});
