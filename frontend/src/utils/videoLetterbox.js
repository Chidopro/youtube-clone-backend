/** Clipchamp / cinematic exports often pad 21:9 picture into 16:9 with black bars. */

const LUMA_MAX = 20;
const COVERAGE = 0.9;
const MIN_FRAC = 0.02;
const MAX_FRAC = 0.22;
const SAMPLE_STEP = 16;

function luma(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function scanDarkRun(isDark, size, maxPx) {
  let n = 0;
  while (n < maxPx && isDark(n)) n += 1;
  return n;
}

export function detectLetterboxFromCanvas(ctx, width, height) {
  if (!ctx || !width || !height) return null;
  const maxY = Math.floor(height * MAX_FRAC);
  const maxX = Math.floor(width * MAX_FRAC);
  const cols = Math.ceil(width / SAMPLE_STEP);
  const rows = Math.ceil(height / SAMPLE_STEP);

  const isDarkRow = (y) => {
    const data = ctx.getImageData(0, y, width, 1).data;
    let dark = 0;
    for (let x = 0; x < width; x += SAMPLE_STEP) {
      const i = x * 4;
      if (luma(data[i], data[i + 1], data[i + 2]) < LUMA_MAX) dark += 1;
    }
    return dark / cols >= COVERAGE;
  };
  const isDarkCol = (x) => {
    const data = ctx.getImageData(x, 0, 1, height).data;
    let dark = 0;
    for (let y = 0; y < height; y += SAMPLE_STEP) {
      const i = y * 4;
      if (luma(data[i], data[i + 1], data[i + 2]) < LUMA_MAX) dark += 1;
    }
    return dark / rows >= COVERAGE;
  };

  const mid = ctx.getImageData(Math.floor(width / 2), Math.floor(height / 2), 1, 1).data;
  const hasContent = luma(mid[0], mid[1], mid[2]) >= LUMA_MAX;
  if (!hasContent) return null;

  let top = scanDarkRun(isDarkRow, height, maxY);
  let bottom = scanDarkRun((i) => isDarkRow(height - 1 - i), height, maxY);
  let left = scanDarkRun(isDarkCol, width, maxX);
  let right = scanDarkRun((i) => isDarkCol(width - 1 - i), width, maxX);

  const minY = Math.floor(height * MIN_FRAC);
  const minX = Math.floor(width * MIN_FRAC);
  if (top < minY || bottom < minY) {
    top = 0;
    bottom = 0;
  }
  if (left < minX || right < minX) {
    left = 0;
    right = 0;
  }
  if (Math.abs(top - bottom) > Math.max(24, height * 0.04)) {
    top = Math.min(top, bottom);
    bottom = top;
  }
  if (Math.abs(left - right) > Math.max(24, width * 0.04)) {
    left = Math.min(left, right);
    right = left;
  }
  if (!top && !bottom && !left && !right) return null;
  return { top, bottom, left, right, videoW: width, videoH: height, hasContent: true };
}

export function detectLetterboxFromVideo(videoElement) {
  if (!videoElement) return null;
  const width = videoElement.videoWidth || 0;
  const height = videoElement.videoHeight || 0;
  if (!width || !height || videoElement.readyState < 2) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(videoElement, 0, 0);
    return detectLetterboxFromCanvas(ctx, width, height);
  } catch {
    return null;
  }
}

export function mergeLetterboxMin(samples) {
  const valid = (samples || []).filter((s) => s && s.hasContent);
  if (!valid.length) return null;
  const first = valid[0];
  const merged = {
    top: Math.min(...valid.map((s) => s.top || 0)),
    bottom: Math.min(...valid.map((s) => s.bottom || 0)),
    left: Math.min(...valid.map((s) => s.left || 0)),
    right: Math.min(...valid.map((s) => s.right || 0)),
    videoW: first.videoW,
    videoH: first.videoH,
    hasContent: true,
  };
  if (!merged.top && !merged.bottom && !merged.left && !merged.right) return null;
  return merged;
}

export function letterboxInsetCss(box) {
  if (!box || !box.videoW || !box.videoH) return '';
  const top = (box.top / box.videoH) * 100;
  const bottom = (box.bottom / box.videoH) * 100;
  const left = (box.left / box.videoW) * 100;
  const right = (box.right / box.videoW) * 100;
  if (top < 0.4 && bottom < 0.4 && left < 0.4 && right < 0.4) return '';
  return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
}

export function readLetterboxDataset(videoElement, videoW, videoH) {
  const raw = String(videoElement?.dataset?.letterbox || '').trim();
  if (!raw) return { top: 0, bottom: 0, left: 0, right: 0 };
  const parts = raw.split(',').map((n) => Number(n));
  if (parts.length < 4 || parts.some((n) => !Number.isFinite(n) || n < 0)) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  const [top, bottom, left, right] = parts;
  if (top + bottom >= videoH || left + right >= videoW) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  return { top, bottom, left, right };
}

export function letterboxSourceRect(videoElement, videoW, videoH) {
  const { top, bottom, left, right } = readLetterboxDataset(videoElement, videoW, videoH);
  return {
    sx: left,
    sy: top,
    sw: Math.max(1, videoW - left - right),
    sh: Math.max(1, videoH - top - bottom),
  };
}
