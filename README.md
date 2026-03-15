# 🖨️ Ink Flow — Printer Maintenance Tracker

**Version 2.0.0** | Windows Desktop Application

Ink Flow is a smart Windows desktop app that helps prevent liquid ink printer nozzle clogging by tracking printer usage, sending automatic maintenance prints, detecting external print jobs, and alerting you when printers sit idle too long.

> **Why?** Liquid ink printers (inkjet, EcoTank, SuperTank, etc.) can clog their nozzles if left unused for extended periods. Ink Flow ensures every printer gets used regularly — automatically.

---

## ✨ Features

### Core Printer Management

- **Add, edit, and delete printers** with custom names, models, ink types, idle thresholds, and warning periods
- **Auto-detect system printers** — scans Windows for installed printers via WMI and lets you add them instantly
- **Online/offline status** — real-time printer connectivity checks with visual indicators
- **Manual logging** — quickly record "Printed" or "Cleaned" actions per printer

### Smart Monitoring

- **Idle countdown timer** — each printer card shows a progress bar counting down to the maintenance deadline
- **Overdue severity levels** — Low Risk, Moderate Risk, High Risk, and Critical Risk based on how long a printer has been idle
- **Automatic print job detection** — monitors the Windows Print Service event log (Event ID 307) every 5 minutes and auto-logs detected print jobs
- **Print job deduplication** — won't double-count events within a ±2 minute window

### Automatic Maintenance

- **Auto maintenance printing** — when enabled, automatically sends a test page to overdue/urgent printers using `notepad.exe /p` (antivirus-safe, no shell commands)
- **Offline-aware** — skips auto-printing for offline printers and notifies you instead
- **Configurable per-printer** — set custom max idle days and warning thresholds for each printer

### Notifications & Alerts

- **Hourly status checks** — automatically scans all printers and triggers alerts for those needing attention
- **Standalone alert popup** — always-on-top, frameless window that appears over all apps even when the main window is hidden
- **In-app alert modal** — color-coded, severity-sorted alerts with dismiss confirmation
- **Taskbar flashing** — grabs your attention when printers need maintenance
- **Escalating severity** — alerts escalate from Warning → Urgent → Overdue → Severe → Critical based on idle duration

### Advanced History

- **Full event timeline** — all maintenance events grouped by date with relative timestamps ("2h ago", "Yesterday")
- **Multi-filter system** — filter by event type (prints/cleans), date range (today, 7d, 30d, 90d, all), specific printer, or search text
- **Source detection** — each event is tagged as Manual, Auto-detected, Auto-maintenance, or Test print
- **Summary statistics** — total events, print count, clean count, and auto-detected count
- **Delete events** — remove individual events with double-click confirmation
- **Export CSV** — copy filtered history to clipboard as CSV with one click

### Statistics Dashboard

- **30-day activity chart** — stacked bar chart showing daily prints and cleans with hover tooltips
- **Per-printer breakdown** — sorted by total activity with visual progress bars
- **Summary cards** — total printers tracked and total events logged

### Settings & Preferences

- **Start with Windows** — auto-launch minimized to system tray on login
- **Auto maintenance print toggle** — enable/disable automatic test printing
- **Dark / Light theme** — full theme support across all UI components
- **Backup & Restore** — export and import all printer data as JSON files

### System Tray

- **Minimize to tray** — closing the window hides to tray instead of quitting
- **Tray context menu** — Show Ink Flow / Quit
- **Double-click to show** — quickly access the app from the tray
- **Hidden startup** — starts minimized to tray when launched at Windows boot

---

## 🛠️ Tech Stack

| Technology       | Version | Purpose                                   |
| ---------------- | ------- | ----------------------------------------- |
| **Electron**     | 33.2.0  | Desktop framework, native OS integration  |
| **React**        | 18.3    | UI components                             |
| **TypeScript**   | 5.7     | Type-safe code across main and renderer   |
| **Vite**         | 6.0     | Fast renderer bundling                    |
| **Tailwind CSS** | 3.4     | Utility-first styling with dark mode      |

---

## 📁 Project Structure

```text
Ink Flow/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── assets/
│   └── icon.png
├── src/
│   ├── main/                          # Electron main process
│   │   ├── main.ts                    # App entry, window & tray creation
│   │   ├── store.ts                   # JSON data persistence (atomic writes)
│   │   ├── ipc-handlers.ts            # IPC API bridge (22+ channels)
│   │   ├── preload.ts                 # Context-isolated renderer API
│   │   ├── printer-detect.ts          # Windows WMI printer detection
│   │   ├── notifications.ts           # Hourly status checker & alert dispatcher
│   │   ├── auto-print.ts              # Safe test printing via notepad.exe
│   │   ├── print-monitor.ts           # Windows Event Log print job scanner
│   │   ├── autostart.ts               # Windows startup shortcut management
│   │   ├── alert-window.ts            # Standalone always-on-top alert popup
│   │   ├── tray.ts                    # System tray icon & context menu
│   │   └── window-ref.ts              # Shared window reference module
│   └── renderer/                      # React frontend
│       ├── index.tsx                   # React mount point
│       ├── App.tsx                     # Root component & state management
│       ├── index.html                  # HTML template
│       ├── globals.css                 # Base Tailwind styles
│       ├── ThemeContext.tsx             # Dark/light theme provider
│       ├── types/
│       │   └── index.ts                # TypeScript interfaces & Window API types
│       ├── hooks/
│       │   └── useEscapeKey.ts         # Reusable Escape key hook for modals
│       └── components/
│           ├── Layout.tsx              # Main UI shell with navigation
│           ├── Dashboard.tsx           # Printer grid with action buttons
│           ├── PrinterCard.tsx         # Individual printer status card
│           ├── AddPrinterModal.tsx     # Create new printer form
│           ├── EditPrinterModal.tsx    # Edit printer settings
│           ├── DetectPrintersModal.tsx  # Auto-detect system printers
│           ├── HistoryPanel.tsx        # Advanced event history viewer
│           ├── SettingsPanel.tsx       # App settings & backup
│           ├── StatisticsPanel.tsx     # Activity charts & stats

│           └── AlertModal.tsx          # In-app alert display
└── dist/                              # Compiled output
    ├── main/                          # Compiled Electron main process
    └── renderer/                      # Bundled React app
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ with npm
- **Windows 10/11** (required for printer detection, event log monitoring, and startup integration)

### Installation

```bash
# Clone or navigate to the project
cd "Ink Flow"

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Available Scripts

| Command          | Description                                         |
| ---------------- | --------------------------------------------------- |
| `npm run dev`    | Start dev server (Vite + Electron with hot reload)  |
| `npm run build`  | Compile TypeScript + bundle renderer with Vite      |
| `npm start`      | Launch the built app with Electron                  |
| `npm run package`| Build + generate Windows NSIS installer             |

---

## 📦 Building for Distribution

```bash
# Build and create Windows installer
npm run package
```

This generates an NSIS installer in the `release/` directory. The installer allows users to choose their installation directory.

---

## 🔧 How It Works

### Data Storage

All printer and event data is stored in a single JSON file at:

```text
%APPDATA%/ink-flow/inkflow-data.json
```

- **Atomic writes** — uses temp file + rename to prevent corruption
- **Auto-migration** — automatically adds missing fields when loading older data formats
- **ID management** — recalculates ID counters on load to prevent collisions

### Print Job Detection

The app queries the Windows Print Service Operational event log using PowerShell:

```powershell
Get-WinEvent -LogName "Microsoft-Windows-PrintService/Operational"
  -FilterXPath "*[System[EventID=307]]" -MaxEvents 50
```

This detects **Document Printed** events and matches them against your tracked printers by name.

### Safe Test Printing

Instead of using shell commands (which trigger antivirus false positives), the app:

1. Writes a text file to a temp directory using `fs.writeFileSync()`
2. Launches `notepad.exe /p tempfile.txt` using Node.js `execFile()` (no shell)
3. Cleans up the temp file after printing

### Notification Flow

```text
Every 60 minutes:
  → Check all printer statuses
  → Build alert list (warning/urgent/overdue/severe/critical)
  → Show standalone alert popup (always-on-top)
  → Send alerts to renderer (in-app modal)
  → Flash taskbar + restore window
  → Run auto-maintenance prints (if enabled)
```

---

## 🎨 Themes

Ink Flow supports **Dark** and **Light** themes. Toggle from the top navigation bar. The theme preference is persisted across sessions.

---

## ⌨️ Keyboard Shortcuts

| Key      | Action                         |
| -------- | ------------------------------ |
| `Escape` | Close any open modal or panel  |

---

## 🔒 Security

- **Context isolation** enabled on all windows (main + alert popup)
- **Sandbox** enabled on popup windows
- **No `nodeIntegration`** in any renderer process
- **No shell execution** — all system commands use `execFile()` with explicit paths
- **Atomic file writes** — prevents data corruption on crashes
- **HTML escaping** — all dynamic content in alert popups is escaped (including single quotes)
- **Input validation** — imported data is validated for correct structure before loading

---

## 📋 Requirements

- **Operating System**: Windows 10 or Windows 11
- **Windows Print Spooler** service must be running (default on all Windows with printers)
- **PowerShell** (pre-installed on all modern Windows)
- No additional Windows services or drivers required

---

## 📄 License

This project is proprietary software.

---

**Built with ❤️ for printer maintenance peace of mind.**
