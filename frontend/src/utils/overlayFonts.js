const SYSTEM_OVERLAY_FONTS = new Set([
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Courier New',
]);

// These files are regular-only. Canvas ignores the family when bold is requested
// and no 700 face exists, so every one of them draws as the fallback serif.
const REGULAR_ONLY_OVERLAY_FONTS = new Set([
  'IM FELL English',
  'Uncial Antiqua',
  'MedievalSharp',
  'Great Vibes',
  'Anton',
  'Permanent Marker',
  'Bebas Neue',
  'Creepster',
  'Dela Gothic One',
  'Long Cang',
  'Pacifico',
]);

export const TEXT_FONT_GROUPS = [
  {
    label: 'Classic',
    options: [
      { value: 'IM FELL English', label: 'IM FELL English (Old Bible)' },
      { value: 'Libre Baskerville', label: 'Libre Baskerville' },
      { value: 'Cinzel', label: 'Cinzel (Roman inscription)' },
      { value: 'Cormorant Garamond', label: 'Cormorant Garamond' },
      { value: 'Playfair Display', label: 'Playfair Display' },
      { value: 'Arial', label: 'Arial' },
      { value: 'Helvetica', label: 'Helvetica' },
      { value: 'Georgia', label: 'Georgia' },
      { value: 'Times New Roman', label: 'Times New Roman' },
      { value: 'Verdana', label: 'Verdana' },
      { value: 'Courier New', label: 'Courier New' },
    ],
  },
  {
    label: 'Biblical & decorative',
    options: [
      { value: 'Uncial Antiqua', label: 'Uncial Antiqua (Manuscript)' },
      { value: 'MedievalSharp', label: 'MedievalSharp' },
      { value: 'Great Vibes', label: 'Great Vibes (Elegant script)' },
      { value: 'Caveat', label: 'Caveat (Handwritten)' },
    ],
  },
  {
    label: 'Bold merchandise',
    options: [
      { value: 'Oswald', label: 'Oswald' },
      { value: 'Anton', label: 'Anton' },
    ],
  },
  {
    label: 'Fringe & style',
    options: [
      { value: 'Permanent Marker', label: 'Permanent Marker (Graffiti)' },
      { value: 'Orbitron', label: 'Orbitron (Metal)' },
      { value: 'Bebas Neue', label: 'Bebas Neue' },
      { value: 'Creepster', label: 'Creepster (Scary / Halloween)' },
      { value: 'Dela Gothic One', label: 'Dela Gothic One' },
      { value: 'Long Cang', label: 'Long Cang (Chinese brush)' },
      { value: 'Pacifico', label: 'Pacifico (Hawaiian / surf)' },
    ],
  },
];

export const TEXT_TOOL_GOOGLE_FONTS = TEXT_FONT_GROUPS
  .flatMap((group) => group.options.map((option) => option.value))
  .filter((family) => !SYSTEM_OVERLAY_FONTS.has(family));

export const GOOGLE_FONTS_STYLESHEET_URL = 'https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Caveat:wght@400;700&family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:wght@400;600;700&family=Creepster&family=Dela+Gothic+One&family=Great+Vibes&family=IM+Fell+English&family=Libre+Baskerville:wght@400;700&family=Long+Cang&family=MedievalSharp&family=Orbitron:wght@400;700&family=Oswald:wght@400;600;700&family=Pacifico&family=Permanent+Marker&family=Playfair+Display:wght@400;600;700&family=Uncial+Antiqua&display=swap';

export function overlayFontSupportsBold(family) {
  return !REGULAR_ONLY_OVERLAY_FONTS.has(String(family || '').trim());
}

export function overlayFontFauxBold(family, bold) {
  return Boolean(bold) && !overlayFontSupportsBold(family);
}

export function overlayCanvasFont(family, sizePx, bold, fallback = 'Georgia, serif') {
  const name = String(family || 'Arial').replace(/"/g, '').trim() || 'Arial';
  const size = Math.max(1, Number(sizePx) || 16);
  const weight = bold && overlayFontSupportsBold(name) ? 'bold ' : '';
  return `${weight}${size}px "${name}", ${fallback}`;
}

export function overlayFontLoadSpec(family, bold = false) {
  const name = String(family || 'Arial').replace(/"/g, '').trim() || 'Arial';
  const weight = bold && overlayFontSupportsBold(name) ? 'bold ' : '';
  return `${weight}16px "${name}"`;
}
