import { encodeRgbaPng } from './png';

/**
 * Renders a color maintenance test page as a PNG buffer.
 *
 * Pattern: stacked solid-color bars that fire every ink channel.
 * Top-to-bottom:
 *   Black           — exercises K
 *   Cyan            — exercises C
 *   Magenta         — exercises M
 *   Yellow          — exercises Y
 *   Composite       — Red (M+Y), Green (C+Y), Blue (C+M) for blending
 *   Grey gradient   — fades 0–100% K so nozzle drop-out shows as banding
 *
 * Compared to the old `notepad.exe /p` text print which only laid down
 * black, this lights up every nozzle at saturation plus the most common
 * mid-tone blends.
 */

const WIDTH = 600;
const HEIGHT = 800;
const BAR_HEIGHT = 100;

interface Color { r: number; g: number; b: number; }

const BARS: Color[] = [
  { r: 0,   g: 0,   b: 0 },     // K — black
  { r: 0,   g: 255, b: 255 },   // C — cyan
  { r: 255, g: 0,   b: 255 },   // M — magenta
  { r: 255, g: 255, b: 0 },     // Y — yellow
];

const COMPOSITE: Color[] = [
  { r: 255, g: 0,   b: 0 },     // Red   = M + Y
  { r: 0,   g: 255, b: 0 },     // Green = C + Y
  { r: 0,   g: 0,   b: 255 },   // Blue  = C + M
];

export function generateColorTestPng(): Buffer {
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  // White background
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 255; pixels[i + 1] = 255; pixels[i + 2] = 255; pixels[i + 3] = 255;
  }

  let y = 60; // top margin

  // Four solid CMYK bars
  for (const color of BARS) {
    drawBar(pixels, 50, y, WIDTH - 100, BAR_HEIGHT, color);
    y += BAR_HEIGHT + 20;
  }

  // Composite bar (R/G/B thirds)
  const thirdWidth = Math.floor((WIDTH - 100) / 3);
  for (let i = 0; i < 3; i++) {
    drawBar(pixels, 50 + i * thirdWidth, y, thirdWidth, BAR_HEIGHT, COMPOSITE[i]);
  }
  y += BAR_HEIGHT + 20;

  // Grey gradient — full black at right, white at left
  const gradY = y;
  const gradW = WIDTH - 100;
  for (let dx = 0; dx < gradW; dx++) {
    const level = 255 - Math.round((dx / gradW) * 255);
    drawBar(pixels, 50 + dx, gradY, 1, BAR_HEIGHT, { r: level, g: level, b: level });
  }

  return encodeRgbaPng(WIDTH, HEIGHT, pixels);
}

function drawBar(pixels: Buffer, x: number, y: number, w: number, h: number, c: Color): void {
  for (let py = y; py < y + h && py < HEIGHT; py++) {
    for (let px = x; px < x + w && px < WIDTH; px++) {
      const idx = (py * WIDTH + px) * 4;
      pixels[idx] = c.r;
      pixels[idx + 1] = c.g;
      pixels[idx + 2] = c.b;
      pixels[idx + 3] = 255;
    }
  }
}
