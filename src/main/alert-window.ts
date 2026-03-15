import { BrowserWindow, screen, ipcMain } from 'electron';

let alertWindow: BrowserWindow | null = null;

interface AlertData {
  name: string;
  status: string;
  level: string;
  message: string;
}

/**
 * Shows a native always-on-top popup window with printer alerts.
 * This window is completely independent of the main app window —
 * it appears on top of ALL applications even when the app is in the tray.
 */
export function showAlertPopup(alerts: AlertData[]): void {
  // If already showing, close the old one before creating a new one
  if (alertWindow && !alertWindow.isDestroyed()) {
    alertWindow.close();
    alertWindow = null;
  }

  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;
  const popupW = 460;
  const popupH = Math.min(160 + alerts.length * 100, 520);

  alertWindow = new BrowserWindow({
    width: popupW,
    height: popupH,
    x: screenW - popupW - 20,
    y: screenH - popupH - 20,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const htmlContent = buildAlertHtml(alerts);
  alertWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

  alertWindow.once('ready-to-show', () => {
    alertWindow?.show();
    alertWindow?.focus();
  });

  alertWindow.on('closed', () => {
    alertWindow = null;
  });
}

/** Close the alert popup from the renderer side via title change. */
function setupCloseListener(): void {
  // The popup signals dismissal by changing its document title
  // We detect this from the main process without needing IPC
}

/** Close the alert popup. */
ipcMain.on('close-alert-popup', () => {
  closeAlertPopup();
});

export function closeAlertPopup(): void {
  if (alertWindow && !alertWindow.isDestroyed()) {
    alertWindow.close();
    alertWindow = null;
  }
}

function buildAlertHtml(alerts: AlertData[]): string {
  const sorted = [...alerts].sort((a, b) => {
    const pri: Record<string, number> = { critical: 0, severe: 1, overdue: 2, urgent: 3, warning: 4 };
    return (pri[a.level] ?? 5) - (pri[b.level] ?? 5);
  });

  const worst = sorted[0]?.level || 'warning';
  const hasCritical = worst === 'critical' || worst === 'severe';
  const hasOverdue = worst === 'overdue' || worst === 'urgent';

  const headerBg = hasCritical ? '#7f1d1d' : hasOverdue ? '#7c2d12' : '#713f12';
  const headerIcon = hasCritical ? '🚨' : hasOverdue ? '🔴' : '⚠️';
  const headerTitle = hasCritical ? 'CRITICAL PRINTER ALERT' : hasOverdue ? 'Printer Alert' : 'Maintenance Reminder';
  const btnColor = hasCritical ? '#dc2626' : hasOverdue ? '#ea580c' : '#ca8a04';
  const btnHover = hasCritical ? '#b91c1c' : hasOverdue ? '#c2410c' : '#a16207';

  const alertCards = sorted.map(a => {
    const cfg: Record<string, { icon: string; color: string; bg: string; border: string }> = {
      critical: { icon: '🚨', color: '#f87171', bg: 'rgba(127,29,29,0.6)', border: '#dc2626' },
      severe:   { icon: '🔥', color: '#f87171', bg: 'rgba(127,29,29,0.5)', border: '#b91c1c' },
      overdue:  { icon: '⛔', color: '#f87171', bg: 'rgba(127,29,29,0.4)', border: '#991b1b' },
      urgent:   { icon: '🔴', color: '#fb923c', bg: 'rgba(124,45,18,0.5)', border: '#c2410c' },
      warning:  { icon: '⚠️', color: '#fbbf24', bg: 'rgba(113,63,18,0.5)', border: '#a16207' },
    };
    const c = cfg[a.level] || cfg.warning;
    return `
      <div style="display:flex;align-items:flex-start;gap:12px;padding:14px;border-radius:12px;border:2px solid ${c.border};background:${c.bg};margin-bottom:8px;">
        <span style="font-size:22px;flex-shrink:0;margin-top:2px;">${c.icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-weight:700;font-size:14px;color:${c.color};">${escapeHtml(a.name)}</span>
            <span style="font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:12px;background:rgba(255,255,255,0.1);color:${c.color};">${escapeHtml(a.level)}</span>
          </div>
          <p style="font-size:13px;color:#d1d5db;margin:0;line-height:1.4;">${escapeHtml(a.message)}</p>
        </div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body {
    background: transparent;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e5e7eb;
    user-select: none;
  }
  .container {
    background: #111827;
    border-radius: 16px;
    box-shadow: 0 25px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 100vh;
    -webkit-app-region: drag;
  }
  .header {
    background: ${headerBg};
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .header-icon { font-size: 28px; }
  .header-title { font-size: 15px; font-weight: 700; color: #fff; }
  .header-sub { font-size: 12px; color: rgba(255,255,255,0.7); }
  .alerts {
    padding: 16px;
    flex: 1;
    overflow-y: auto;
    -webkit-app-region: no-drag;
  }
  .alerts::-webkit-scrollbar { width: 6px; }
  .alerts::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
  .footer {
    padding: 12px 20px;
    background: rgba(31,41,55,0.5);
    border-top: 1px solid #1f2937;
    display: flex;
    align-items: center;
    justify-content: space-between;
    -webkit-app-region: no-drag;
  }
  .footer-text { font-size: 11px; color: #6b7280; max-width: 240px; }
  .btn {
    padding: 8px 20px;
    border-radius: 8px;
    border: none;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    background: ${btnColor};
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn:hover { background: ${btnHover}; }
  ${hasCritical ? `
  @keyframes pulse-border {
    0%, 100% { box-shadow: 0 25px 50px rgba(0,0,0,0.6), 0 0 0 2px #dc2626; }
    50% { box-shadow: 0 25px 50px rgba(0,0,0,0.6), 0 0 20px 2px #dc2626; }
  }
  .container { animation: pulse-border 2s ease-in-out infinite; }
  ` : ''}
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="header-icon">${headerIcon}</span>
      <div>
        <div class="header-title">${headerTitle}</div>
        <div class="header-sub">${alerts.length} printer${alerts.length > 1 ? 's need' : ' needs'} your attention</div>
      </div>
    </div>
    <div class="alerts">
      ${alertCards}
    </div>
    <div class="footer">
      <span class="footer-text">${hasCritical ? 'Turn on your printer(s) and run a cleaning cycle immediately!' : 'Take action to prevent nozzle clogging.'}</span>
      <button class="btn" onclick="dismiss()">I understand</button>
    </div>
  </div>
  <script>
    function dismiss() {
      window.close();
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') dismiss();
    });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
