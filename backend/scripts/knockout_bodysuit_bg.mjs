/**
 * Punch the studio background out of the white Baby Body Suit mockup.
 * Uses the original pink blank as the garment silhouette so light sleeves
 * are not mistaken for the grey studio.
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

function isPinkGarment(r, g, b, a) {
  if (a < 20) return false;
  if (isMintGuide(r, g, b)) return false;
  return r > g + 8 && r > b + 4 && r > 160 && g > 90;
}

function knockoutFromPinkMask(whiteBuf, pinkBuf) {
  const white = PNG.sync.read(whiteBuf);
  const pink = PNG.sync.read(pinkBuf);
  if (white.width !== pink.width || white.height !== pink.height) {
    throw new Error('white/pink mockup size mismatch');
  }
  const { width: w, height: h, data } = white;
  const mask = pink.data;
  let kept = 0;
  let cleared = 0;
  for (let i = 0; i < data.length; i += 4) {
    const pr = mask[i];
    const pg = mask[i + 1];
    const pb = mask[i + 2];
    const pa = mask[i + 3];
    if (isMintGuide(data[i], data[i + 1], data[i + 2])) {
      kept += 1;
      continue;
    }
    if (isPinkGarment(pr, pg, pb, pa)) {
      kept += 1;
      continue;
    }
    data[i + 3] = 0;
    cleared += 1;
  }
  return { buf: PNG.sync.write(white), kept, cleared, w, h };
}

function run(whiteName, pinkName, destName) {
  const result = knockoutFromPinkMask(
    fs.readFileSync(path.join(imagesDir, whiteName)),
    fs.readFileSync(path.join(imagesDir, pinkName)),
  );
  fs.writeFileSync(path.join(imagesDir, destName), result.buf);
  console.log(
    destName,
    `${result.w}x${result.h}`,
    'kept',
    result.kept,
    'cleared',
    result.cleared,
  );
}

run('kidsbabybodysuitpreview3.png', 'kidsbabybodysuitpreview2.png', 'kidsbabybodysuitpreview6.png');
run('kidsbabybodysuit3.png', 'kidsbabybodysuit2.png', 'kidsbabybodysuit6.png');
