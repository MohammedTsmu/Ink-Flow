import { describe, it, expect } from 'vitest';
import { parsePageLogLine } from '../printers/cups';

describe('parsePageLogLine', () => {
  it('returns null for blank lines', () => {
    expect(parsePageLogLine('')).toBeNull();
    expect(parsePageLogLine('   ')).toBeNull();
  });

  it('returns null for lines without a bracketed timestamp', () => {
    expect(parsePageLogLine('HP_LaserJet user 1 garbage')).toBeNull();
  });

  it('parses a standard CUPS page_log entry', () => {
    const line = 'HP_LaserJet root 123 [01/Jan/2025:14:30:00 +0000] 1 1 - 192.168.1.5';
    const evt = parsePageLogLine(line);
    expect(evt).not.toBeNull();
    expect(evt?.printerName).toBe('HP_LaserJet');
    expect(evt?.documentName).toBe('Job 123');
    expect(evt?.timeCreated).toBe('2025-01-01T14:30:00+00:00');
  });

  it('handles printer names containing underscores and digits', () => {
    const evt = parsePageLogLine('Brother_HL_L2350DW jane 42 [02/Feb/2025:09:15:30 -0500] 3 1 - localhost');
    expect(evt?.printerName).toBe('Brother_HL_L2350DW');
    expect(evt?.documentName).toBe('Job 42');
    expect(evt?.timeCreated).toBe('2025-02-02T09:15:30-05:00');
  });

  it('falls back to current time when the date format is unexpected', () => {
    const evt = parsePageLogLine('Printer user 1 [not-a-date] 1 1 - host');
    expect(evt?.printerName).toBe('Printer');
    expect(evt?.timeCreated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
