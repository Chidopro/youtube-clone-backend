export const TEXT_MASK_COLORS = {
  cream: { label: 'Warm cream', hex: '#fff8e6', rgb: [255, 248, 230] },
  charcoal: { label: 'Soft charcoal', hex: '#302f2a', rgb: [48, 47, 42] },
};

export function normalizeTextMaskColor(value) {
  return String(value || '').trim().toLowerCase() === 'charcoal' ? 'charcoal' : 'cream';
}

export function normalizeScriptureStyle(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['highlighted', 'minimal'].includes(normalized) ? normalized : 'classic';
}

export function clampTextMaskOpacity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
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
    const words = paragraph.trim().split(/\s+/).filter(Boolean).flatMap((word) => (
      ctx.measureText(word).width > maxWidth ? splitLongWord(ctx, word, maxWidth) : [word]
    ));
    const count = words.length;
    if (!count) return;
    const costs = new Array(count + 1).fill(Infinity);
    const nextBreak = new Array(count).fill(count);
    costs[count] = 0;
    for (let start = count - 1; start >= 0; start -= 1) {
      let line = '';
      for (let end = start; end < count; end += 1) {
        line = line ? `${line} ${words[end]}` : words[end];
        const width = ctx.measureText(line).width;
        if (width > maxWidth && end > start) break;
        const slack = Math.max(0, maxWidth - width);
        const isLast = end === count - 1;
        const penalty = (isLast ? 0.18 : 1) * slack * slack + costs[end + 1];
        if (penalty < costs[start]) {
          costs[start] = penalty;
          nextBreak[start] = end + 1;
        }
      }
    }
    for (let start = 0; start < count;) {
      const end = Math.max(start + 1, nextBreak[start]);
      lines.push(words.slice(start, end).join(' '));
      start = end;
    }
  });
  return lines;
}

function scriptureSections(value, style, highlight) {
  const verse = String(value || '').trim();
  const mode = normalizeScriptureStyle(style);
  const phrase = String(highlight || '').trim();
  if (mode === 'minimal') {
    return [{ text: phrase || verse, scale: 1.12, bold: true, kind: 'highlight' }];
  }
  if (mode === 'highlighted' && phrase) {
    const index = verse.toLocaleLowerCase().indexOf(phrase.toLocaleLowerCase());
    if (index >= 0) {
      let selected = verse.slice(index, index + phrase.length);
      let after = verse.slice(index + phrase.length);
      const punctuation = after.match(/^\s*([,;:.!?])/);
      if (punctuation) {
        selected += punctuation[1];
        after = after.slice(punctuation[0].length);
      }
      return [
        { text: verse.slice(0, index).trim(), scale: 0.72, bold: false, kind: 'body' },
        { text: selected, scale: 1.04, bold: true, kind: 'highlight' },
        { text: after.trim(), scale: 0.72, bold: false, kind: 'body' },
      ].filter((section) => section.text);
    }
  }
  return [{ text: verse, scale: 1, bold: true, kind: 'body' }];
}

export function drawTextMask(ctx, {
  text,
  reference = '',
  scriptureStyle = 'classic',
  highlight = '',
  fontFamily = 'Georgia',
  fontBold,
  textColor = '#30291f',
  fontSize = 84,
  minFontSize = 18,
  lineHeight = 1.32,
  safeArea,
  maskEnabled = false,
  maskColor = 'cream',
  maskOpacity = 0,
  offsetX,
  offsetY,
}) {
  const value = String(text || '').trim();
  if (!value || !ctx?.canvas) return null;

  const normalizedArea = normalizeTextSafeArea(safeArea);
  const style = normalizeScriptureStyle(scriptureStyle);
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  const area = {
    x: canvasWidth * normalizedArea.x / 100,
    y: canvasHeight * normalizedArea.y / 100,
    width: canvasWidth * normalizedArea.width / 100,
    height: canvasHeight * normalizedArea.height / 100,
  };
  const paddingX = area.width * 0.075;
  const paddingY = area.height * 0.11;
  const availableWidth = Math.max(1, area.width - paddingX * 2);
  const availableHeight = Math.max(1, area.height - paddingY * 2);
  const baseBold = typeof fontBold === 'boolean' ? fontBold : true;
  const sections = scriptureSections(value, style, highlight);
  const ref = String(reference || '').trim();
  let fittedSize = Math.max(minFontSize, Number(fontSize) || 84);
  let layout = [];
  let totalHeight = 0;
  let measuredWidth = 0;

  const buildLayout = (baseSize) => {
    const rows = [];
    let height = 0;
    let widest = 0;
    sections.forEach((section, sectionIndex) => {
      const sectionSize = Math.max(minFontSize * 0.72, baseSize * section.scale);
      const sectionBold = section.kind === 'highlight' ? true : (style === 'classic' ? baseBold : section.bold);
      ctx.font = `${sectionBold ? 'bold ' : ''}${sectionSize}px "${fontFamily}", Georgia, serif`;
      const lines = wrapCanvasText(ctx, section.text, availableWidth);
      const rowHeight = sectionSize * lineHeight;
      if (sectionIndex > 0) height += baseSize * 0.24;
      lines.forEach((line) => {
        widest = Math.max(widest, ctx.measureText(line).width);
        rows.push({ text: line, size: sectionSize, bold: sectionBold, height: rowHeight, kind: section.kind });
        height += rowHeight;
      });
    });
    if (ref) {
      const referenceSize = Math.max(minFontSize * 0.68, baseSize * 0.58);
      height += baseSize * 0.42;
      ctx.font = `${referenceSize}px "${fontFamily}", Georgia, serif`;
      const referenceLines = wrapCanvasText(ctx, ref, availableWidth);
      referenceLines.forEach((line) => {
        const rowHeight = referenceSize * 1.2;
        widest = Math.max(widest, ctx.measureText(line).width);
        rows.push({ text: line, size: referenceSize, bold: false, height: rowHeight, kind: 'reference' });
        height += rowHeight;
      });
    }
    return { rows, height, widest };
  };

  ctx.save();
  let candidate = buildLayout(fittedSize);
  while (candidate.height > availableHeight && fittedSize > minFontSize) {
    fittedSize = Math.max(minFontSize, fittedSize - Math.max(1, Math.ceil(fittedSize / 40)));
    candidate = buildLayout(fittedSize);
  }
  layout = candidate.rows;
  totalHeight = candidate.height;
  measuredWidth = Math.min(availableWidth, Math.max(candidate.widest, fittedSize));
  const fits = totalHeight <= availableHeight;
  const hasOffsetX = Number.isFinite(Number(offsetX));
  const hasOffsetY = Number.isFinite(Number(offsetY));
  const centerX = hasOffsetX
    ? canvasWidth * Math.max(0, Math.min(100, Number(offsetX))) / 100
    : area.x + area.width / 2;
  const textCenterY = hasOffsetY
    ? canvasHeight * Math.max(0, Math.min(100, Number(offsetY))) / 100
    : area.y + area.height / 2;

  if (maskEnabled && clampTextMaskOpacity(maskOpacity) > 0) {
    const color = TEXT_MASK_COLORS[normalizeTextMaskColor(maskColor)].rgb.join(',');
    const maskWidth = Math.min(canvasWidth, measuredWidth + paddingX * 2.2);
    const maskHeight = Math.min(canvasHeight, totalHeight + paddingY * 1.5);
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
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let cursorY = textCenterY - totalHeight / 2;
  layout.forEach((row, index) => {
    if (index > 0 && row.kind !== layout[index - 1].kind) {
      cursorY += fittedSize * (row.kind === 'reference' ? 0.42 : 0.24);
    }
    ctx.font = `${row.bold ? 'bold ' : ''}${row.size}px "${fontFamily}", Georgia, serif`;
    ctx.lineWidth = Math.max(0.55, row.size * 0.01);
    const lineY = cursorY + row.height / 2;
    ctx.strokeText(row.text, centerX, lineY);
    ctx.fillText(row.text, centerX, lineY);
    cursorY += row.height;
  });
  ctx.restore();

  return {
    lines: layout.map((row) => row.text),
    fontSize: fittedSize,
    centerX,
    centerY: textCenterY,
    fits,
    safeArea: normalizedArea,
  };
}
