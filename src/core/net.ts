import net from 'net';
import { ConnectivityStatus } from './printers/types';

/**
 * Open a TCP socket to host:port and resolve based on the outcome.
 *   connect  → 'online'
 *   timeout  → 'offline'
 *   error    → 'offline'
 *
 * Used by adapter implementations to verify a network printer is
 * actually reachable, rather than trusting the spooler's stale
 * cached status.
 */
export function probeTcp(host: string, port: number, timeoutMs = 3000): Promise<ConnectivityStatus> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (verdict: ConnectivityStatus) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch { /* ignore */ }
      resolve(verdict);
    };

    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish('online'));
    socket.once('timeout', () => finish('offline'));
    socket.once('error', () => finish('offline'));

    try {
      socket.connect(port, host);
    } catch {
      finish('offline');
    }
  });
}

/**
 * Extract an IPv4 address from a port name string like
 * "192.168.1.5_RAW", "IP_192.168.1.5", or "10.0.0.4". Returns null
 * when no IP is present (e.g. USB001).
 */
export function extractIpv4(portName: string): string | null {
  if (!portName) return null;
  const m = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/.exec(portName);
  return m ? m[1] : null;
}

/** Standard raw-print TCP port for network printers (RFC 1179 / JetDirect). */
export const RAW_PRINT_PORT = 9100;
