export const IMAGE_OPACITY_DEFAULT = 100;

export function clampImageOpacity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return IMAGE_OPACITY_DEFAULT;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function imageOpacityCss(value) {
  return clampImageOpacity(value) / 100;
}

export function imageOpacityHasEdit(value) {
  return clampImageOpacity(value) < IMAGE_OPACITY_DEFAULT;
}
