export const TEXT_MASK_COLORS = {
  cream: { label: 'Warm cream', hex: '#fff8e6', rgb: [255, 248, 230] },
  charcoal: { label: 'Soft charcoal', hex: '#302f2a', rgb: [48, 47, 42] },
};

export function normalizeTextMaskColor(value) {
  return String(value || '').trim().toLowerCase() === 'charcoal' ? 'charcoal' : 'cream';
}

export function clampTextMaskOpacity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 85;
  return Math.max(0, Math.min(100, Math.round(number)));
}

export function normalizeTextSafeArea(area) {
  const source = area && typeof area === 'object' ? area : {};
  const clamp = (value, fallback, min, max) => {
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
  };
  const x = clamp(source.x, 8, 0, 95);
  const y = clamp(source.y, 25, 0, 95);
  return {
    x,
    y,
    width: clamp(source.width, 84, 5, 100 - x),
    height: clamp(source.height, 50, 5, 100 - y),
  };
}

function splitLongWord(ctx, word, maxWidth) {
  const chunks = [];
  let chunk = '';
  Array.from(word).forEach((character) => {
    const candidate = `${chunk}${character}`;
    if (chunk && ctx.measureText(candidate).width > maxWidth) {
      chunks.push(chunk);
      chunk = character;
    } else {
      chunk = candidate;
    }
  });
  if (chunk) chunks.push(chunk);
  return chunks;
}

export function wrapCanvasText(ctx, text, maxWidth) {
  const paragraphs = String(text || '').trim().split(/\n+/);
  const lines = [];
  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = '';
    words.forEach((word) => {
      const parts = ctx.measureText(word).width > maxWidth
        ? splitLongWord(ctx, word, maxWidth)
        : [word];
      parts.forEach((part) => {
        const candidate = line ? `${line} ${part}` : part;
        if (line && ctx.measureText(candidate).width > maxWidth) {
          lines.push(line);
          line = part;
        } else {
          line = candidate;
        }
      });
    });
    if (line) lines.push(line);
    line = '';
  });
  return lines;
}

export function drawTextMask(ctx, {
  text,
  fontFamily = 'Georgia',
  textColor = '#30291f',
  fontSize = 84,
  minFontSize = 18,
  lineHeight = 1.25,
  safeArea,
  maskEnabled = false,
  maskColor = 'cream',
  maskOpacity = 85,
}) {
  const value = String(text || '').trim();
  if (!value || !ctx?.canvas) return null;

  const normalizedArea = normalizeTextSafeArea(safeArea);
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  const area = {
    x: canvasWidth * normalizedArea.x / 100,
    y: canvasHeight * normalizedArea.y / 100,
    width: canvasWidth * normalizedArea.width / 100,
    height: canvasHeight * normalizedArea.height / 100,
  };
  const paddingX = area.width * 0.1;
  const paddingY = area.height * 0.16;
  const availableWidth = Math.max(1, area.width - paddingX * 2);
  const availableHeight = Math.max(1, area.height - paddingY * 2);
  let fittedSize = Math.max(minFontSize, Number(fontSize) || 84);
  let lines = [];
  const fontWeight = String(fontFamily || '').toLowerCase() === 'im fell english' ? '' : 'bold ';

  ctx.save();
  while (fittedSize >= minFontSize) {
    ctx.font = `${fontWeight}${fittedSize}px "${fontFamily}", Georgia, serif`;
    lines = wrapCanvasText(ctx, value, availableWidth);
    if (lines.length * fittedSize * lineHeight <= availableHeight) break;
    fittedSize -= Math.max(1, Math.ceil(fittedSize / 40));
  }
  fittedSize = Math.max(minFontSize, fittedSize);
  ctx.font = `${fontWeight}${fittedSize}px "${fontFamily}", Georgia, serif`;
  lines = wrapCanvasText(ctx, value, availableWidth);

  const actualLineHeight = fittedSize * lineHeight;
  const totalHeight = lines.length * actualLineHeight;
  const measuredWidth = Math.min(
    availableWidth,
    Math.max(...lines.map((line) => ctx.measureText(line).width), fittedSize)
  );
  const centerX = area.x + area.width / 2;
  const centerY = area.y + area.height / 2;
  const textCenterY = centerY + Math.min(paddingY * 0.65, fittedSize * 0.9);

  if (maskEnabled && clampTextMaskOpacity(maskOpacity) > 0) {
    const color = TEXT_MASK_COLORS[normalizeTextMaskColor(maskColor)].rgb.join(',');
    const maskWidth = Math.min(canvasWidth, measuredWidth + paddingX * 2.4);
    const maskHeight = Math.min(canvasHeight, totalHeight + paddingY * 1.2);
    const maskLeft = Math.max(0, Math.min(canvasWidth - maskWidth, centerX - maskWidth / 2));
    const maskTop = Math.max(0, Math.min(canvasHeight - maskHeight, textCenterY - maskHeight / 2));
    const cornerRadius = Math.min(maskHeight * 0.2, maskWidth * 0.08);
    const feather = Math.max(2, Math.min(maskWidth, maskHeight) * 0.045);
    ctx.save();
    const alpha = clampTextMaskOpacity(maskOpacity) / 100;
    ctx.fillStyle = `rgba(${color},${alpha})`;
    ctx.shadowColor = `rgba(${color},${alpha * 0.75})`;
    ctx.shadowBlur = feather;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(maskLeft, maskTop, maskWidth, maskHeight, cornerRadius);
    } else {
      ctx.rect(maskLeft, maskTop, maskWidth, maskHeight);
    }
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = textColor || '#30291f';
  ctx.strokeStyle = textColor || '#30291f';
  ctx.lineWidth = Math.max(0.6, fittedSize * 0.012);
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const firstLineY = textCenterY - ((lines.length - 1) * actualLineHeight) / 2;
  lines.forEach((line, index) => {
    const lineY = firstLineY + index * actualLineHeight;
    ctx.strokeText(line, centerX, lineY);
    ctx.fillText(line, centerX, lineY);
  });
  ctx.restore();

  return {
    lines,
    fontSize: fittedSize,
    centerX,
    centerY: textCenterY,
    safeArea: normalizedArea,
  };
}
