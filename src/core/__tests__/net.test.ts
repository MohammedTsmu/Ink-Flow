import { describe, it, expect } from 'vitest';
import net from 'net';
import { probeTcp, extractIpv4 } from '../net';

describe('extractIpv4', () => {
  it('extracts a bare IP', () => {
    expect(extractIpv4('192.168.1.5')).toBe('192.168.1.5');
  });

  it('extracts from common Windows port names', () => {
    expect(extractIpv4('IP_192.168.1.5')).toBe('192.168.1.5');
    expect(extractIpv4('192.168.1.5_RAW')).toBe('192.168.1.5');
    expect(extractIpv4('WSD-printer-192.168.0.42')).toBe('192.168.0.42');
  });

  it('extracts from CUPS socket URLs', () => {
    expect(extractIpv4('socket://10.0.0.4:9100')).toBe('10.0.0.4');
  });

  it('returns null for non-IP port names', () => {
    expect(extractIpv4('USB001')).toBeNull();
    expect(extractIpv4('LPT1:')).toBeNull();
    expect(extractIpv4('')).toBeNull();
  });
});

describe('probeTcp', () => {
  it('returns online when something is listening', async () => {
    const server = net.createServer().listen(0);
    const port = (server.address() as net.AddressInfo).port;
    try {
      const verdict = await probeTcp('127.0.0.1', port, 500);
      expect(verdict).toBe('online');
    } finally {
      server.close();
    }
  });

  it('returns offline when no one is listening', async () => {
    // Use a port that's almost certainly not in use.
    const verdict = await probeTcp('127.0.0.1', 1, 500);
    expect(verdict).toBe('offline');
  });

  it('returns offline on timeout to an unreachable host', async () => {
    // 192.0.2.x is reserved for documentation — never reachable.
    const verdict = await probeTcp('192.0.2.1', 9100, 500);
    expect(verdict).toBe('offline');
  }, 10000);
});
