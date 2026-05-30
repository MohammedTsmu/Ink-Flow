import { execFile } from 'child_process';
import { warn } from '../log';
import {
  ScheduleProvider,
  ScheduleConfig,
  ScheduleResult,
  ScheduleStatus,
} from './types';

/**
 * Windows scheduler provider — registers a per-user task via
 * Register-ScheduledTask (PowerShell). The task runs whether or not
 * the user is logged in, with the user's own credentials.
 *
 * We wrap the actual executable in cmd /c so we can set the
 * ELECTRON_RUN_AS_NODE=1 environment variable inline (Task Scheduler's
 * own env support is awkward to drive from PowerShell).
 */
export class WindowsScheduleProvider implements ScheduleProvider {
  install(config: ScheduleConfig): Promise<ScheduleResult> {
    const intervalMinutes = Math.max(Math.round(config.intervalSeconds / 60), 1);
    const cmdLine = buildCmdLine(config);

    const ps = [
      `$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c ${escapePsSingle(cmdLine)}';`,
      `$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes ${intervalMinutes});`,
      `$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew;`,
      `$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\\$env:USERNAME" -LogonType S4U -RunLevel Limited;`,
      `Register-ScheduledTask -TaskName '${escapePsSingle(config.label)}' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null;`,
      `Write-Output 'OK'`,
    ].join(' ');

    return runPowerShell(ps).then(
      ({ stdout }) => stdout.includes('OK')
        ? { success: true }
        : { success: false, reason: 'PowerShell did not confirm installation' },
      (err) => {
        warn('schedule-windows', 'install failed', err);
        return { success: false, reason: String(err) };
      },
    );
  }

  uninstall(label: string): Promise<ScheduleResult> {
    const ps = `try { Unregister-ScheduledTask -TaskName '${escapePsSingle(label)}' -Confirm:$false -ErrorAction Stop; Write-Output 'OK' } catch { Write-Output 'OK' }`;
    return runPowerShell(ps).then(
      () => ({ success: true }),
      (err) => {
        warn('schedule-windows', 'uninstall failed', err);
        return { success: false, reason: String(err) };
      },
    );
  }

  async status(label: string): Promise<ScheduleStatus> {
    const ps = `(Get-ScheduledTask -TaskName '${escapePsSingle(label)}' -ErrorAction SilentlyContinue) | ConvertTo-Json -Depth 2`;
    try {
      const { stdout } = await runPowerShell(ps);
      if (!stdout.trim()) return { installed: false };
      const obj = JSON.parse(stdout);
      const info = obj.LastTaskResult !== undefined
        ? `Last result: ${obj.LastTaskResult}, next run: ${obj.NextRunTime ?? 'unknown'}`
        : undefined;
      return { installed: true, detail: info, lastRunAt: obj.LastRunTime };
    } catch {
      return { installed: false };
    }
  }
}

function buildCmdLine(config: ScheduleConfig): string {
  const envPairs = Object.entries(config.env)
    .map(([k, v]) => `set ${k}=${v}`)
    .join(' && ');
  const exe = quote(config.executable);
  const args = config.args.map(quote).join(' ');
  const setAndRun = envPairs ? `${envPairs} && ${exe} ${args}` : `${exe} ${args}`;
  return setAndRun;
}

function quote(s: string): string {
  if (!/[\s"]/.test(s)) return s;
  return '"' + s.replace(/"/g, '\\"') + '"';
}

function escapePsSingle(s: string): string {
  return s.replace(/'/g, "''");
}

function runPowerShell(script: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 30_000 },
      (err, stdout, stderr) => {
        if (err) reject(err);
        else resolve({ stdout: stdout || '', stderr: stderr || '' });
      },
    );
  });
}
