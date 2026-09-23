/**
 * Recolor remaining Kids Tools mockups to white flats and punch out the
 * studio grey so Product Preview can tint them to the cart color.
 * Keeps the mint/pink print-area guide. Does not use Printful on-model photos.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { PNG } = createRequire(import.meta.url)('pngjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, '..', 'static', 'images');

const JOBS = [
  { src: 'kidsshirtpreview.png', aspect: 0.485 / 0.415 },
  { src: 'kidslongsleevepreview.png', aspect: 0.453 / 0.502 },
  { src: 'kidsyouthheavyblendhoodiepreview.png', aspect: 0.258 / 0.363 },
  { src: 'kidssweatshirtpreview.png', aspect: 0.485 / 0.388 },
  { src: 'kidstoddlerjerseytshirtpreview.png', aspect: 0.414 / 0.361 },
  { src: 'kidsbabystapleteepreview.png', aspect: 0.627 / 0.426 },
  { src: 'kidsbabyjerseytshirtpreview.png', aspect: 0.557 / 0.393 },
];

function isMintGuide(r, g, b) {
  return r > 160 && r < 220 && g > r + 12 && g > b + 6 && g > 200 && (g - Math.min(r, b)) > 18;
}

function isPrintBoxColor(r, g, b) {
  const isPinkGuide = r > 190 && r - g > 50 && g < 140 && g > 60;
  return isMintGuide(r, g, b) || isPinkGuide;
}

function lum(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function sat(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function findPrintRect(data, w, h, aspect) {
  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  let hits = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (!isMintGuide(data[i], data[i + 1], data[i + 2])) continue;
      hits += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (hits < 80) return null;
  const boxW = maxX - minX;
  let y2 = maxY;
  const cap = Math.min(h - 1, minY + Math.round(boxW * 1.2));
  for (let y = maxY; y <= cap; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const i = (y * w + x) * 4;
      if (!isPrintBoxColor(data[i], data[i + 1], data[i + 2])) continue;
      if (y > y2) y2 = y;
    }
  }
  return {
    x1: Math.max(0, minX - 1),
    x2: Math.min(w - 1, maxX + 1),
    y1: Math.max(0, minY - 1),
    y2: Math.min(h - 1, y2 + 1),
  };
}

function inPrintRect(x, y, rect) {
  return Boolean(rect && x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2);
}

function floodStudio(data, w, h, rect) {
  const studio = new Uint8Array(w * h);
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (seen[idx]) return;
    seen[idx] = 1;
    stack.push(idx);
  };
  for (let x = 0; x < w; x += 1) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const idx = stack.pop();
    const i = idx * 4;
    const x = idx % w;
    const y = (idx - x) / w;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 20) continue;
    if (inPrintRect(x, y, rect)) continue;
    if (isPrintBoxColor(r, g, b)) continue;
    if (sat(r, g, b) > 16) continue;
    if (lum(r, g, b) < 222) continue;
    studio[idx] = 1;
    push(x - 1, y);
    push(x + 1, y);
    push(x, y - 1);
    push(x, y + 1);
  }
  return studio;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

function processBuffer(buf, aspect) {
  const png = PNG.sync.read(buf);
  const { width: w, height: h, data } = png;
  const rect = findPrintRect(data, w, h, aspect);
  const studio = floodStudio(data, w, h, rect);
  const garmentL = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = y * w + x;
      const i = idx * 4;
      if (data[i + 3] < 20 || studio[idx]) continue;
      if (inPrintRect(x, y, rect) || isMintGuide(data[i], data[i + 1], data[i + 2])) continue;
      garmentL.push(lum(data[i], data[i + 1], data[i + 2]));
    }
  }
  garmentL.sort((a, b) => a - b);
  const p5 = percentile(garmentL, 0.05);
  const p95 = Math.max(p5 + 8, percentile(garmentL, 0.95));
  const span = p95 - p5;
  let garment = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = y * w + x;
      const i = idx * 4;
      if (data[i + 3] < 20) continue;
      if (studio[idx]) {
        data[i + 3] = 0;
        continue;
      }
      if (inPrintRect(x, y, rect) || isMintGuide(data[i], data[i + 1], data[i + 2])) continue;
      const l = lum(data[i], data[i + 1], data[i + 2]);
      const t = Math.max(0, Math.min(1, (l - p5) / span));
      const dest = Math.round(208 + t * 47);
      data[i] = dest;
      data[i + 1] = dest;
      data[i + 2] = Math.max(0, dest - 1);
      garment += 1;
    }
  }
  return {
    buf: PNG.sync.write(png),
    w,
    h,
    garment,
    studio: studio.reduce((n, v) => n + v, 0),
    p5: Math.round(p5),
    p95: Math.round(p95),
  };
}

function destName(src) {
  return src.replace(/\.png$/i, '2.png');
}

for (const job of JOBS) {
  const srcName = job.src;
  const src = path.join(imagesDir, srcName);
  const dest = path.join(imagesDir, destName(srcName));
  const result = processBuffer(fs.readFileSync(src), job.aspect);
  fs.writeFileSync(dest, result.buf);
  console.log(
    destName(srcName),
    `${result.w}x${result.h}`,
    'garment',
    result.garment,
    'studio',
    result.studio,
    'l',
    `${result.p5}-${result.p95}`,
  );
}
