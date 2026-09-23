/**
 * Recolor the flat Baby Body Suit mockup from pink to white.
 * Keeps the mint print-area guide so Tools overlay stays aligned.
 * Printful's white catalog photo is a baby model — do not use it here.
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { PNG } = createRequire(import.meta.url)('pngjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(__dirname, '..', 'static', 'images');

function isMintGuide(r, g, b) {
  return r > 170 && r < 230 && g > r + 10 && g >= b - 5 && g > 200;
}

function isPrintBoxColor(r, g, b) {
  const isPinkGuide = r > 190 && r - g > 50 && g < 140 && g > 60;
  return isMintGuide(r, g, b) || isPinkGuide;
}

function findPrintRect(data, w, h) {
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
  const fullH = Math.round(boxW * (0.471 / 0.424));
  return {
    x1: minX,
    x2: maxX,
    y1: minY,
    y2: Math.min(h - 1, minY + fullH),
  };
}

function recolorBuffer(buf) {
  const png = PNG.sync.read(buf);
  const { width: w, height: h, data } = png;
  const rect = findPrintRect(data, w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 20) continue;
      if (rect && x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2) continue;
      if (isPrintBoxColor(r, g, b)) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max - min;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      // Background and neck tag: low saturation, not the pink garment.
      if (sat < 18 && l > 210) continue;
      if (sat < 22 && Math.abs(r - g) < 14 && Math.abs(g - b) < 14) continue;

      const pinkish = r > g + 8 && r > b + 4 && r > 160 && g > 90;
      if (!pinkish) continue;

      // Lift toward white, keep fold shading from original luminance.
      const shadow = Math.max(0, 255 - l) * 0.42;
      const nr = Math.min(255, Math.round(255 - shadow * 0.92));
      const ng = Math.min(255, Math.round(255 - shadow * 0.96));
      const nb = Math.min(255, Math.round(255 - shadow * 0.98));
      data[i] = nr;
      data[i + 1] = ng;
      data[i + 2] = nb;
    }
  }
  return PNG.sync.write(png);
}

const srcPreview = path.join(imagesDir, 'kidsbabybodysuitpreview2.png');
const destPreview = path.join(imagesDir, 'kidsbabybodysuitpreview3.png');
const srcMain = path.join(imagesDir, 'kidsbabybodysuit2.png');
const destMain = path.join(imagesDir, 'kidsbabybodysuit3.png');

fs.writeFileSync(destPreview, recolorBuffer(fs.readFileSync(srcPreview)));
fs.writeFileSync(destMain, recolorBuffer(fs.readFileSync(srcMain)));
console.log('Wrote', destPreview, destMain);
