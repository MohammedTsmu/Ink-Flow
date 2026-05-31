// Reproduces what dist/main/core/schedule/windows.js does on status('InkFlowTick')
import { execFile } from 'child_process';

function runPowerShell(script) {
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

const label = 'InkFlowTick';
const ps = `(Get-ScheduledTask -TaskName '${label.replace(/'/g, "''")}' -ErrorAction SilentlyContinue) | ConvertTo-Json -Depth 2`;

console.log('--- PS script:');
console.log(ps);
console.log('--- Running...');

try {
  const { stdout, stderr } = await runPowerShell(ps);
  console.log('--- stdout length:', stdout.length);
  console.log('--- stderr length:', stderr.length);
  console.log('--- stdout.trim().slice(0,200):');
  console.log(stdout.trim().slice(0, 200));
  console.log('--- Last 200 chars:');
  console.log(stdout.trim().slice(-200));
  console.log('--- Trying JSON.parse...');
  try {
    const obj = JSON.parse(stdout);
    console.log('--- PARSE SUCCESS');
    console.log('--- typeof obj:', typeof obj, Array.isArray(obj) ? '[Array]' : '');
    console.log('--- obj.TaskName:', obj?.TaskName);
    console.log('--- obj.State:', obj?.State);
    console.log('--- Would return: installed: TRUE');
  } catch (parseErr) {
    console.log('--- PARSE FAILED:', parseErr.message);
    console.log('--- Would return: installed: false (catch path)');
  }
} catch (err) {
  console.log('--- PowerShell threw:', err.message);
  console.log('--- Would return: installed: false');
}
