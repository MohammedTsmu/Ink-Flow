// Polls AppVeyor until the latest build reaches a terminal state.
// Exits 0 on success, 1 on failure, 2 on timeout. Stdout is a JSONL stream of
// observations so the caller can review the timeline.
import https from 'https';

const URL = 'https://ci.appveyor.com/api/projects/MohammedTsmu/Ink-Flow';
const POLL_INTERVAL_MS = 60_000;
const TIMEOUT_MS = 35 * 60_000;
const TERMINAL = new Set(['success', 'failed', 'cancelled']);

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function summariseJobs(jobs = []) {
  return jobs.map(j => `${j.name || j.osType}:${j.status}${j.finished ? ` (${Math.round((new Date(j.finished) - new Date(j.started))/1000)}s)` : ''}`).join(' | ');
}

const start = Date.now();
let last = '';

while (Date.now() - start < TIMEOUT_MS) {
  let payload;
  try {
    payload = await fetchJson(`${URL}?_=${Date.now()}`);
  } catch (err) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), error: String(err) }));
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    continue;
  }
  const b = payload.build;
  const line = `${b.version} status=${b.status} jobs=[${summariseJobs(b.jobs)}]`;
  if (line !== last) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), version: b.version, status: b.status, jobs: b.jobs?.map(j => ({ name: j.name, status: j.status })) }));
    last = line;
  }
  if (TERMINAL.has(b.status)) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), final: true, version: b.version, status: b.status, jobs: b.jobs?.map(j => ({ name: j.name, status: j.status, started: j.started, finished: j.finished })) }));
    process.exit(b.status === 'success' ? 0 : 1);
  }
  await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
}

console.log(JSON.stringify({ ts: new Date().toISOString(), timeout: true }));
process.exit(2);
