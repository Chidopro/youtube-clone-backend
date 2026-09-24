export const BW_INTENSITY_DEFAULT = 50;

export function clampBwIntensity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return BW_INTENSITY_DEFAULT;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** White 0 → recognizable B&W 50 → black 100. Poles wash the photo out. */
export function blackAndWhiteCssFilter(enabled, intensity = BW_INTENSITY_DEFAULT) {
  if (!enabled) return 'none';
  const t = (clampBwIntensity(intensity) - BW_INTENSITY_DEFAULT) / BW_INTENSITY_DEFAULT;
  const u = Math.sign(t) * (Math.abs(t) ** 1.15);
  let brightness = 1;
  let contrast = 1;
  if (u < 0) {
    const w = -u;
    brightness = 1 + w * 7.5;
    contrast = 1 - w * 0.88;
  } else if (u > 0) {
    brightness = 1 - u * 0.97;
    contrast = 1 + u * 2.4;
  }
  return `grayscale(1) brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)})`;
}

export function blackAndWhiteStyle(enabled, intensity = BW_INTENSITY_DEFAULT) {
  const filter = blackAndWhiteCssFilter(enabled, intensity);
  return filter === 'none' ? undefined : filter;
}

export function bwIntensityLabel(intensity) {
  const n = clampBwIntensity(intensity);
  if (n === 0) return 'White';
  if (n === 100) return 'Black';
  if (n === BW_INTENSITY_DEFAULT) return 'Normal';
  if (n < BW_INTENSITY_DEFAULT) return `White ${BW_INTENSITY_DEFAULT - n}`;
  return `Black ${n - BW_INTENSITY_DEFAULT}`;
}
