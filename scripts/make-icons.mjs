// Renders the extension icons, static/icons/icon-{16,32,48,128}.png, from
// assets/hypertag-logo.webp.
// The source has white corners around its rounded square, so we flatten those
// to black, then apply our own anti-aliased rounded-square mask per size.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SOURCE = 'assets/hypertag-logo.webp';
const RADIUS = 0.2; // corner radius as a fraction of the tile (source is ~0.17)
// Toolbar sizes zoom in on the X so it stays legible; 128 follows the Chrome
// Web Store layout (96px artwork inside 16px of transparent padding).
const SIZES = [
  { size: 16, art: 16, zoom: 0.8 },
  { size: 32, art: 32, zoom: 0.84 },
  { size: 48, art: 48, zoom: 1 },
  { size: 128, art: 96, zoom: 1 },
];

const { data: src, info } = await sharp(SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
for (let i = 0; i < src.length; i += 3) {
  const max = Math.max(src[i], src[i + 1], src[i + 2]);
  const min = Math.min(src[i], src[i + 1], src[i + 2]);
  if (max - min < 25) src[i] = src[i + 1] = src[i + 2] = 0; // greys/white -> black
}
const flat = sharp(src, { raw: { width: W, height: info.height, channels: 3 } });

function roundedMask(n) {
  const mask = Buffer.alloc(n * n);
  const SS = 4;
  for (let py = 0; py < n; py++) {
    for (let px = 0; px < n; px++) {
      let hit = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / n;
          const y = (py + (sy + 0.5) / SS) / n;
          const qx = Math.abs(x - 0.5) - (0.5 - RADIUS);
          const qy = Math.abs(y - 0.5) - (0.5 - RADIUS);
          if (Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) <= RADIUS) hit++;
        }
      }
      mask[py * n + px] = Math.round((hit / (SS * SS)) * 255);
    }
  }
  return mask;
}

/** The logo at `art` px, optionally zoomed in, as an RGBA sharp image. */
async function tile(art, { zoom = 1, rounded = true } = {}) {
  const side = Math.round(W * zoom);
  const offset = Math.round((W - side) / 2);
  const rgb = await flat.clone()
    .extract({ left: offset, top: offset, width: side, height: side })
    .resize(art, art, { kernel: 'lanczos3' })
    .raw()
    .toBuffer();
  const mask = rounded ? roundedMask(art) : null;
  const rgba = Buffer.alloc(art * art * 4);
  for (let i = 0; i < art * art; i++) {
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = mask ? mask[i] : 255;
  }
  return sharp(rgba, { raw: { width: art, height: art, channels: 4 } });
}

const png = (img, file) => img.png({ compressionLevel: 9 }).toFile(file);

mkdirSync('static/icons', { recursive: true });
for (const { size, art, zoom } of SIZES) {
  const pad = (size - art) / 2;
  await png((await tile(art, { zoom })).extend({
    top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 },
  }), `static/icons/icon-${size}.png`);
}

console.log('icons written to static/icons/');
