/**
 * One-shot script: upscales assets/icon.png to 1024×1024 so
 * electron-builder accepts it for macOS .icns generation
 * (which requires ≥ 512×512; 1024 is the standard).
 *
 * Run with:  node scripts/upscale-icon.mjs
 */
import { Jimp } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconPath = path.resolve(__dirname, '..', 'assets', 'icon.png');

const img = await Jimp.read(iconPath);
console.log(`Original: ${img.width}×${img.height}`);
if (img.width >= 1024 && img.height >= 1024) {
  console.log('Already large enough — no change.');
  process.exit(0);
}
img.resize({ w: 1024, h: 1024 });
await img.write(iconPath);
console.log(`Resized: ${img.width}×${img.height} → wrote ${iconPath}`);
