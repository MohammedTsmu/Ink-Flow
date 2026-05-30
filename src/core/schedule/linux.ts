import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { warn } from '../log';
import {
  ScheduleProvider,
  ScheduleConfig,
  ScheduleResult,
  ScheduleStatus,
} from './types';

/**
 * Linux systemd --user provider — writes a .service + .timer pair to
 * ~/.config/systemd/user, then enables the timer. Runs while the user
 * is logged in (or always, if `loginctl enable-linger` is set).
 */
export class LinuxScheduleProvider implements ScheduleProvider {
  async install(config: ScheduleConfig): Promise<ScheduleResult> {
    try {
      const unitDir = this.unitDir();
      fs.mkdirSync(unitDir, { recursive: true });
      fs.writeFileSync(this.servicePath(config.label), buildService(config), 'utf-8');
      fs.writeFileSync(this.timerPath(config.label), buildTimer(config), 'utf-8');
      await runSystemctl(['--user', 'daemon-reload']);
      await runSystemctl(['--user', 'enable', '--now', `${config.label}.timer`]);
      return { success: true };
    } catch (err) {
      warn('schedule-linux', 'install failed', err);
      return { success: false, reason: String(err) };
    }
  }

  async uninstall(label: string): Promise<ScheduleResult> {
    try {
      try { await runSystemctl(['--user', 'disable', '--now', `${label}.timer`]); } catch { /* may not exist */ }
      try { fs.unlinkSync(this.timerPath(label)); } catch { /* ignore */ }
      try { fs.unlinkSync(this.servicePath(label)); } catch { /* ignore */ }
      try { await runSystemctl(['--user', 'daemon-reload']); } catch { /* ignore */ }
      return { success: true };
    } catch (err) {
      warn('schedule-linux', 'uninstall failed', err);
      return { success: false, reason: String(err) };
    }
  }

  async status(label: string): Promise<ScheduleStatus> {
    const timerExists = fs.existsSync(this.timerPath(label));
    if (!timerExists) return { installed: false };
    try {
      const { stdout } = await runSystemctl(['--user', 'is-active', `${label}.timer`]);
      const active = stdout.trim() === 'active';
      return { installed: true, detail: active ? 'Timer active' : 'Timer present but not active' };
    } catch {
      return { installed: true, detail: 'Timer files present; systemd state unknown' };
    }
  }

  private unitDir(): string {
    return path.join(os.homedir(), '.config', 'systemd', 'user');
  }
  private servicePath(label: string): string {
    return path.join(this.unitDir(), `${label}.service`);
  }
  private timerPath(label: string): string {
    return path.join(this.unitDir(), `${label}.timer`);
  }
}

function buildService(config: ScheduleConfig): string {
  const envLines = Object.entries(config.env)
    .map(([k, v]) => `Environment="${k}=${escapeIni(v)}"`)
    .join('\n');
  const execLine = [config.executable, ...config.args].map(systemdEscape).join(' ');
  return `[Unit]
Description=Ink Flow printer maintenance tick

[Service]
Type=oneshot
${envLines}
ExecStart=${execLine}
`;
}

function buildTimer(config: ScheduleConfig): string {
  return `[Unit]
Description=Ink Flow tick timer

[Timer]
OnBootSec=10min
OnUnitActiveSec=${config.intervalSeconds}s
Persistent=true

[Install]
WantedBy=timers.target
`;
}

function escapeIni(s: string): string {
  return s.replace(/"/g, '\\"');
}

function systemdEscape(s: string): string {
  // systemd ExecStart quoting: spaces require escaping or quoting.
  if (/\s/.test(s)) return '"' + s.replace(/"/g, '\\"') + '"';
  return s;
}

function runSystemctl(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile('systemctl', args, { timeout: 15_000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout: stdout || '', stderr: stderr || '' });
    });
  });
}
