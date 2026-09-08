/** Shopper edit recipe so admin can replay Tools after 300 DPI (percent + px). */

function round1(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 10) / 10;
}

function asNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

export function cornerRadiusPx(percent, width, height) {
  const pct = asNumber(percent);
  const w = asNumber(width);
  const h = asNumber(height);
  if (!(pct > 0) || !(w > 0) || !(h > 0)) return 0;
  const maxRadius = Math.min(w, h) / 2;
  return pct >= 100 ? maxRadius : (pct / 100) * maxRadius;
}

export function featherPx(percent, width, height) {
  const pct = asNumber(percent);
  const w = asNumber(width);
  const h = asNumber(height);
  if (!(pct > 0) || !(w > 0) || !(h > 0)) {
    return { x: 0, y: 0 };
  }
  return {
    x: (pct / 100) * (w * 0.5),
    y: (pct / 100) * (h * 0.5),
  };
}

export function editLogHasEntries(log) {
  if (!log || typeof log !== 'object') return false;
  if (asNumber(log.featherPercent) > 0) return true;
  if (asNumber(log.cornerRadiusPercent) > 0) return true;
  if (log.frameEnabled) return true;
  if (log.blackAndWhite) return true;
  if (log.featherFadeEnabled) return true;
  if (log.textEnabled && String(log.textContent || '').trim()) return true;
  if (String(log.imageOrientation || '').toLowerCase() === 'landscape') return true;
  const fit = String(log.printAreaFit || '');
  return Boolean(fit && fit !== 'none');
}

export function buildEditLog({
  bakedWidth = 0,
  bakedHeight = 0,
  printWidth = 0,
  printHeight = 0,
  featherEdge = 0,
  cornerRadius = 0,
  frameEnabled = false,
  frameColor = '#FF0000',
  frameWidth = 10,
  doubleFrame = false,
  blackAndWhite = false,
  featherFadeEnabled = false,
  featherFadeColor = 'white',
  textEnabled = false,
  textContent = '',
  textFont = 'Arial',
  textColor = '#000000',
  textSize = 24,
  textOffsetX = 50,
  textOffsetY = 50,
  printAreaFit = 'none',
  imageOrientation = 'portrait',
  imageOffsetX = 0,
  imageOffsetY = 0,
  screenshotScale = 100,
  selectedProductName = '',
} = {}) {
  const bakedW = asNumber(bakedWidth);
  const bakedH = asNumber(bakedHeight);
  const printW = asNumber(printWidth);
  const printH = asNumber(printHeight);
  const featherPct = asNumber(featherEdge);
  const cornerPct = asNumber(cornerRadius);
  const bakedFeather = featherPx(featherPct, bakedW, bakedH);
  const printFeather = featherPx(featherPct, printW, printH);
  const bakedMin = Math.min(bakedW, bakedH);
  const printMin = Math.min(printW, printH);
  const scaleToPrint = bakedMin > 0 && printMin > 0 ? printMin / bakedMin : 0;
  const framePx = asNumber(frameWidth);
  const textOn = Boolean(textEnabled && String(textContent || '').trim());

  return {
    imageWidth: Math.round(bakedW) || 0,
    imageHeight: Math.round(bakedH) || 0,
    printWidth: Math.round(printW) || 0,
    printHeight: Math.round(printH) || 0,
    cornerRadiusPercent: cornerPct,
    cornerRadiusPx: round1(cornerRadiusPx(cornerPct, bakedW, bakedH)),
    cornerRadiusPrintPx: round1(cornerRadiusPx(cornerPct, printW, printH)),
    featherPercent: featherPct,
    featherPxX: round1(bakedFeather.x),
    featherPxY: round1(bakedFeather.y),
    featherPrintPxX: round1(printFeather.x),
    featherPrintPxY: round1(printFeather.y),
    frameEnabled: Boolean(frameEnabled),
    frameColor: frameColor || '#FF0000',
    frameWidthPx: framePx,
    frameWidthPrintPx: scaleToPrint ? round1(framePx * scaleToPrint) : 0,
    doubleFrame: Boolean(doubleFrame),
    blackAndWhite: Boolean(blackAndWhite),
    featherFadeEnabled: Boolean(featherFadeEnabled),
    featherFadeColor: featherFadeEnabled && featherFadeColor === 'black' ? 'black' : 'white',
    textEnabled: textOn,
    textContent: textOn ? String(textContent) : '',
    textFont: textFont || 'Arial',
    textColor: textColor || '#000000',
    textSize: asNumber(textSize, 24),
    textOffsetX: asNumber(textOffsetX, 50),
    textOffsetY: asNumber(textOffsetY, 50),
    printAreaFit: printAreaFit || 'none',
    imageOrientation: imageOrientation === 'landscape' ? 'landscape' : 'portrait',
    imageOffsetX: asNumber(imageOffsetX),
    imageOffsetY: asNumber(imageOffsetY),
    screenshotScale: asNumber(screenshotScale, 100),
    selectedProductName: selectedProductName || '',
  };
}

function pxPair(x, y) {
  const a = round1(x);
  const b = round1(y);
  if (a === b) return `${a}px`;
  return `${a}px H × ${b}px V`;
}

export function formatEditLogLines(log) {
  if (!log || typeof log !== 'object') return [];
  const lines = [];
  const imgW = asNumber(log.imageWidth);
  const imgH = asNumber(log.imageHeight);
  if (imgW > 0 && imgH > 0) {
    lines.push({ label: 'Edited image', value: `${Math.round(imgW)} × ${Math.round(imgH)} px` });
  }
  const printW = asNumber(log.printWidth);
  const printH = asNumber(log.printHeight);
  if (printW > 0 && printH > 0) {
    lines.push({ label: '300 DPI target', value: `${Math.round(printW)} × ${Math.round(printH)} px` });
  }
  const ori = String(log.imageOrientation || 'portrait');
  lines.push({ label: 'Orientation', value: ori === 'landscape' ? 'Landscape' : 'Portrait' });
  if (log.selectedProductName) {
    lines.push({ label: 'Product', value: String(log.selectedProductName) });
  }
  const fit = String(log.printAreaFit || 'none');
  if (fit && fit !== 'none') {
    lines.push({ label: 'Fit', value: fit === 'product' ? 'Product specific' : fit });
  }
  const scale = asNumber(log.screenshotScale, 100);
  if (scale && scale !== 100) {
    lines.push({ label: 'Screenshot size', value: `${scale}%` });
  }
  const ox = asNumber(log.imageOffsetX);
  const oy = asNumber(log.imageOffsetY);
  if (ox || oy) {
    lines.push({ label: 'Offset', value: `H ${ox}% · V ${oy}%` });
  }
  const featherPct = asNumber(log.featherPercent);
  if (featherPct > 0) {
    const baked = pxPair(log.featherPxX, log.featherPxY);
    const print = (asNumber(log.featherPrintPxX) > 0 || asNumber(log.featherPrintPxY) > 0)
      ? ` → 300 DPI ${pxPair(log.featherPrintPxX, log.featherPrintPxY)}`
      : '';
    const fade = log.featherFadeEnabled
      ? ` · fade ${log.featherFadeColor === 'black' ? 'black' : 'white'}`
      : ' · fade transparent';
    lines.push({ label: 'Feather', value: `${featherPct}% (${baked}${print})${fade}` });
  }
  const cornerPct = asNumber(log.cornerRadiusPercent);
  if (cornerPct > 0) {
    const bakedPx = round1(log.cornerRadiusPx);
    const printPx = round1(log.cornerRadiusPrintPx);
    const circle = cornerPct >= 100 ? ' · circle' : '';
    const print = printPx > 0 ? ` → 300 DPI ${printPx}px` : '';
    lines.push({ label: 'Corner', value: `${cornerPct}% (${bakedPx}px${print})${circle}` });
  }
  if (log.frameEnabled) {
    const printFrame = asNumber(log.frameWidthPrintPx) > 0
      ? ` → 300 DPI ${round1(log.frameWidthPrintPx)}px`
      : '';
    const dbl = log.doubleFrame ? ' · double' : '';
    lines.push({
      label: 'Frame',
      value: `${asNumber(log.frameWidthPx)}px ${log.frameColor || ''}${printFrame}${dbl}`.trim(),
    });
  }
  if (log.blackAndWhite) {
    lines.push({ label: 'Color', value: 'Black and white' });
  }
  if (log.textEnabled && String(log.textContent || '').trim()) {
    const snippet = String(log.textContent).trim();
    const shown = snippet.length > 60 ? `${snippet.slice(0, 57)}...` : snippet;
    lines.push({
      label: 'Text',
      value: `"${shown}" · ${log.textFont || 'Arial'} · ${log.textColor || '#000'} · ${asNumber(log.textSize, 24)}px · pos ${asNumber(log.textOffsetX, 50)}%, ${asNumber(log.textOffsetY, 50)}%`,
    });
  }
  return lines;
}

export function formatEditLogPlainText(log) {
  const lines = formatEditLogLines(log);
  if (!lines.length) return '';
  return ['Edit log (replicate after 300 DPI)', ...lines.map((row) => `${row.label}: ${row.value}`)].join('\n');
}

export function editLogFromToolSettings(ts) {
  if (!ts || typeof ts !== 'object') return null;
  if (ts.editLog && typeof ts.editLog === 'object') return ts.editLog;
  return buildEditLog({
    bakedWidth: ts.imageWidth || ts.bakedWidth || 0,
    bakedHeight: ts.imageHeight || ts.bakedHeight || 0,
    printWidth: ts.printWidth || 0,
    printHeight: ts.printHeight || 0,
    featherEdge: ts.featherEdge,
    cornerRadius: ts.cornerRadius,
    frameEnabled: ts.frameEnabled,
    frameColor: ts.frameColor,
    frameWidth: ts.frameWidth,
    doubleFrame: ts.doubleFrame,
    blackAndWhite: ts.blackAndWhite,
    featherFadeEnabled: ts.featherFadeEnabled,
    featherFadeColor: ts.featherFadeColor,
    textEnabled: ts.textEnabled,
    textContent: ts.textContent,
    textFont: ts.textFont,
    textColor: ts.textColor,
    textSize: ts.textSize,
    textOffsetX: ts.textOffsetX,
    textOffsetY: ts.textOffsetY,
    printAreaFit: ts.printAreaFit,
    imageOrientation: ts.imageOrientation,
    imageOffsetX: ts.imageOffsetX || ts.offsetX,
    imageOffsetY: ts.imageOffsetY || ts.offsetY,
    screenshotScale: ts.screenshotScale,
    selectedProductName: ts.selectedProductName,
  });
}
