import { Tray, Menu, app, nativeImage, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';

export function createTray(mainWindow: BrowserWindow): Tray {
  const icon = loadIcon();
  const tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Ink Flow',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Ink Flow - Printer Maintenance Tracker');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}

// ── Icon loading ──────────────────────────────────────────────

function loadIcon(): Electron.NativeImage {
  const candidates = [
    path.join(__dirname, '../../assets/icon.png'),
    path.join(process.resourcesPath || '', 'assets/icon.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return nativeImage.createFromPath(p).resize({ width: 16, height: 16 });
    }
  }
  return createFallbackIcon();
}

// ── Programmatic fallback icon (blue droplet, 16×16) ─────────

function createFallbackIcon(): Electron.NativeImage {
  const size = 16;
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - 7.5, dy = y - 7.5;
      if (dx * dx + dy * dy < 49) {
        pixels[i] = 59;       // R
        pixels[i + 1] = 130;  // G
        pixels[i + 2] = 246;  // B
        pixels[i + 3] = 255;  // A
      }
    }
  }

  const png = buildPng(size, size, pixels);
  return nativeImage.createFromBuffer(png).resize({ width: 16, height: 16 });
}

function buildPng(w: number, h: number, rgba: Buffer): Buffer {
  // Row data with filter byte (0 = None) per row
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const rowOff = y * (w * 4 + 1);
    raw[rowOff] = 0;
    rgba.copy(raw, rowOff + 1, y * w * 4, (y + 1) * w * 4);
  }
  const deflated = zlib.deflateSync(raw);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([t, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crcBuf]);
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}
