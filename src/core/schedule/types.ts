/**
 * Cross-platform scheduler abstraction for the headless tick.
 *
 * Each OS has a different way of running a Node script on an interval
 * while the user is logged in:
 *
 *   Windows  →  Task Scheduler (schtasks / Register-ScheduledTask)
 *   macOS    →  LaunchAgent in ~/Library/LaunchAgents
 *   Linux    →  systemd --user timer in ~/.config/systemd/user
 *
 * The provider hides those details behind install/uninstall/status.
 */

export interface ScheduleConfig {
  /**
   * Stable identifier for the task. Used as the Task Scheduler task
   * name on Windows, the Label on macOS LaunchAgents, and the unit
   * name on systemd --user.
   */
  label: string;

  /** Path to the executable to run (typically the Electron binary). */
  executable: string;

  /**
   * Args passed to the executable. Typically the tick.js path plus
   * --user-data=... so the headless run hits the same store file as
   * the GUI.
   */
  args: string[];

  /** Env vars set on each invocation (notably ELECTRON_RUN_AS_NODE=1). */
  env: Record<string, string>;

  /** How often to fire the tick, in seconds. */
  intervalSeconds: number;
}

export interface ScheduleResult {
  success: boolean;
  reason?: string;
}

export interface ScheduleStatus {
  installed: boolean;
  /** Optional human-readable description of state. */
  detail?: string;
  /** ISO timestamp of the last known successful run, if available. */
  lastRunAt?: string;
}

export interface ScheduleProvider {
  /** Install or update the scheduled task. */
  install(config: ScheduleConfig): Promise<ScheduleResult>;
  /** Remove the scheduled task. */
  uninstall(label: string): Promise<ScheduleResult>;
  /** Inspect whether the task currently exists. */
  status(label: string): Promise<ScheduleStatus>;
}
