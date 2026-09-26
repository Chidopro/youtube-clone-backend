/** How a cover-cropped creator photo should sit in a wide card.
 * Tall photos keep the top of the frame so a head is not cut off.
 * Landscape and square photos stay centered.
 * Creators do not pick a crop; the photo's own shape decides.
 */
export function coverFramePosition(img) {
  const w = img?.naturalWidth || 0;
  const h = img?.naturalHeight || 0;
  if (!w || !h) return 'center center';
  if (h > w) return 'center top';
  return 'center center';
}

export function applyCoverFrame(img) {
  if (!img?.naturalWidth || !img?.naturalHeight) return;
  img.style.objectPosition = coverFramePosition(img);
}
