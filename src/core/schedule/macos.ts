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
 * macOS LaunchAgent provider — writes a plist to
 * ~/Library/LaunchAgents and loads it via launchctl. Runs only while
 * the user is logged in (sufficient for personal-use Ink Flow).
 */
export class MacosScheduleProvider implements ScheduleProvider {
  async install(config: ScheduleConfig): Promise<ScheduleResult> {
    const plistPath = this.plistPathFor(config.label);
    try {
      fs.mkdirSync(path.dirname(plistPath), { recursive: true });
      fs.writeFileSync(plistPath, buildPlist(config), 'utf-8');
      // launchctl bootstrap is the modern way; fall back to load for older macOS.
      const uid = (process.getuid?.() ?? 0).toString();
      try {
        await runLaunchctl(['bootstrap', `gui/${uid}`, plistPath]);
      } catch {
        await runLaunchctl(['load', '-w', plistPath]);
      }
      return { success: true };
    } catch (err) {
      warn('schedule-macos', 'install failed', err);
      return { success: false, reason: String(err) };
    }
  }

  async uninstall(label: string): Promise<ScheduleResult> {
    const plistPath = this.plistPathFor(label);
    try {
      const uid = (process.getuid?.() ?? 0).toString();
      try {
        await runLaunchctl(['bootout', `gui/${uid}/${label}`]);
      } catch {
        await runLaunchctl(['unload', '-w', plistPath]);
      }
      try { fs.unlinkSync(plistPath); } catch { /* ignore */ }
      return { success: true };
    } catch (err) {
      warn('schedule-macos', 'uninstall failed', err);
      return { success: false, reason: String(err) };
    }
  }

  async status(label: string): Promise<ScheduleStatus> {
    const plistPath = this.plistPathFor(label);
    if (!fs.existsSync(plistPath)) return { installed: false };
    try {
      const { stdout } = await runLaunchctl(['list', label]);
      return { installed: true, detail: stdout.trim() || undefined };
    } catch {
      return { installed: true, detail: 'Plist present, not loaded yet' };
    }
  }

  private plistPathFor(label: string): string {
    return path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`);
  }
}

function buildPlist(config: ScheduleConfig): string {
  const argsXml = [config.executable, ...config.args]
    .map(escapeXml)
    .map(a => `    <string>${a}</string>`)
    .join('\n');
  const envXml = Object.entries(config.env)
    .map(([k, v]) => `    <key>${escapeXml(k)}</key>\n    <string>${escapeXml(v)}</string>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(config.label)}</string>
  <key>ProgramArguments</key>
  <array>
${argsXml}
  </array>
  <key>EnvironmentVariables</key>
  <dict>
${envXml}
  </dict>
  <key>StartInterval</key>
  <integer>${config.intervalSeconds}</integer>
  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function runLaunchctl(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile('launchctl', args, { timeout: 15_000 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout: stdout || '', stderr: stderr || '' });
    });
  });
}
