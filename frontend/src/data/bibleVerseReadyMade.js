import {
  BIBLE_VERSE_TEMPLATES,
  KJV_PROVERB_PRESETS,
  formatProverbDesignText,
  recommendedScriptureHighlight,
  textPositionDefaults,
} from './bibleVerseMerch';

export const BIBLE_VERSE_READY_MADE_STYLE = Object.freeze({
  scriptureStyle: 'highlighted',
  textFont: 'Cinzel',
  textBold: true,
  textMaskEnabled: false,
  textMaskOpacity: 0,
});

export const READY_MADE_TEXT_COLOR = '#ffffff';

// These owner-saved verses remain fallbacks so the ready-made shop is complete
// even if the optional storefront verse request is briefly unavailable.
export const BIBLE_VERSE_READY_MADE_SAVED_VERSES = [
  {
    id: 'saved-fc672a01ac984ae4',
    reference: 'Jeremiah 17:7',
    text: 'But blessed is the one who trusts in the Lord, whose confidence is in him.',
    preserveCase: true,
    cleanShopText: true,
  },
  {
    id: 'saved-25e667089ee4407c',
    reference: 'Psalm 23:4',
    text: 'I will fear no evil for thou art with me.',
    preserveCase: true,
    cleanShopText: true,
  },
  {
    id: 'saved-2ba90a3fc5f24395',
    reference: 'Romans 12:12',
    text: 'Be joyful in hope, patient in affliction, faithful in prayer.',
    preserveCase: true,
    cleanShopText: true,
  },
  {
    id: 'saved-d910089f5c404fac',
    reference: 'Psalm 46:1',
    text: 'God is our refuge and strength, an ever present help in trouble.',
    preserveCase: true,
    cleanShopText: true,
  },
  {
    id: 'saved-b87eb72055da4d76',
    reference: 'John 15:9',
    text: 'As the father has loved me, so have I loved you. Now remain in my love.',
    preserveCase: true,
    cleanShopText: true,
  },
];

// Source: BibleVerse_ReadyMade_Preparation/production_pairings.csv.
// Lion and Lamb at Golden Sunset (bvm-template-30) is intentionally excluded.
export const BIBLE_VERSE_READY_MADE_DESIGNS = [
  { id: 'bvm-ready-47', templateId: 'bvm-template-47', verseId: 'john-7-38' },
  { id: 'bvm-ready-48', templateId: 'bvm-template-48', verseId: 'proverbs-4-23' },
  { id: 'bvm-ready-49', templateId: 'bvm-template-49', verseId: 'proverbs-27-17' },
  { id: 'bvm-ready-50', templateId: 'bvm-template-50', verseId: 'proverbs-16-9' },
  { id: 'bvm-ready-51', templateId: 'bvm-template-51', verseId: 'proverbs-18-10' },
  { id: 'bvm-ready-52', templateId: 'bvm-template-52', verseId: 'proverbs-31-25' },
  { id: 'bvm-ready-41', templateId: 'bvm-template-41', verseId: 'proverbs-15-1' },
  { id: 'bvm-ready-42', templateId: 'bvm-template-42', verseId: 'proverbs-27-17' },
  { id: 'bvm-ready-43', templateId: 'bvm-template-43', verseId: 'proverbs-16-9' },
  { id: 'bvm-ready-44', templateId: 'bvm-template-44', verseId: 'proverbs-31-25' },
  { id: 'bvm-ready-45', templateId: 'bvm-template-45', verseId: 'proverbs-31-25' },
  { id: 'bvm-ready-46', templateId: 'bvm-template-46', verseId: 'proverbs-31-25' },
  { id: 'bvm-ready-34', templateId: 'bvm-template-34', verseId: 'revelation-5-12' },
  { id: 'bvm-ready-35', templateId: 'bvm-template-35', verseId: 'isaiah-11-6' },
  { id: 'bvm-ready-36', templateId: 'bvm-template-36', verseId: 'proverbs-3-5-6' },
  { id: 'bvm-ready-37', templateId: 'bvm-template-37', verseId: 'proverbs-18-10' },
  { id: 'bvm-ready-38', templateId: 'bvm-template-38', verseId: 'proverbs-4-23' },
  { id: 'bvm-ready-39', templateId: 'bvm-template-39', verseId: 'proverbs-17-22' },
  { id: 'bvm-ready-40', templateId: 'bvm-template-40', verseId: 'proverbs-17-22' },
  { id: 'bvm-ready-01', templateId: 'bvm-template-01', verseId: 'proverbs-3-5-6' },
  { id: 'bvm-ready-02', templateId: 'bvm-template-02', verseId: 'john-7-38' },
  { id: 'bvm-ready-33', templateId: 'bvm-template-33', verseId: 'john-7-38' },
  { id: 'bvm-ready-03', templateId: 'bvm-template-03', verseId: 'psalm-119-105' },
  { id: 'bvm-ready-13', templateId: 'bvm-template-13', verseId: 'proverbs-18-10' },
  { id: 'bvm-ready-14', templateId: 'bvm-template-14', verseId: 'isaiah-41-18' },
  { id: 'bvm-ready-16', templateId: 'bvm-template-16', verseId: 'saved-25e667089ee4407c' },
  { id: 'bvm-ready-17', templateId: 'bvm-template-17', verseId: 'saved-2ba90a3fc5f24395' },
  { id: 'bvm-ready-20', templateId: 'bvm-template-20', verseId: 'luke-14-27' },
  { id: 'bvm-ready-21', templateId: 'bvm-template-21', verseId: 'proverbs-27-17' },
  { id: 'bvm-ready-22', templateId: 'bvm-template-22', verseId: 'psalm-36-6' },
  { id: 'bvm-ready-23', templateId: 'bvm-template-23', verseId: 'hebrews-6-18' },
  { id: 'bvm-ready-24', templateId: 'bvm-template-24', verseId: 'proverbs-3-7' },
  { id: 'bvm-ready-25', templateId: 'bvm-template-25', verseId: 'revelation-5-12' },
  { id: 'bvm-ready-26', templateId: 'bvm-template-26', verseId: 'proverbs-31-25' },
  { id: 'bvm-ready-27', templateId: 'bvm-template-27', verseId: 'proverbs-16-3' },
  { id: 'bvm-ready-28', templateId: 'bvm-template-28', verseId: '1-corinthians-15-58' },
  { id: 'bvm-ready-29', templateId: 'bvm-template-29', verseId: 'john-11-25' },
  { id: 'bvm-ready-31', templateId: 'bvm-template-31', verseId: '2-corinthians-9-15' },
  { id: 'bvm-ready-32', templateId: 'bvm-template-32', verseId: 'luke-4-23' },
];

// Shop-card layout. Text color is white on every ready-made design.
// Zoom 40 is the Tools label "Out 60%". Zoom 100 is "Fill", matching the shop card.
// Image offset -53 is "Left 53%". Image offset Y 48 is "Down 48%", which
// centers a portrait print (the print starts at 26%) on the same crop as the shop.
const READY_MADE_ADJUSTMENTS = {
  'bvm-ready-01': { scriptureStyle: 'minimal' },
  'bvm-ready-03': { textOffsetY: 40 },
  'bvm-ready-13': { scriptureStyle: 'minimal' },
  'bvm-ready-14': { textOffsetY: 41 },
  // Fill and a centered portrait crop so the shirt matches the shop card.
  // The citation is drawn once; it is not repeated inside the verse.
  'bvm-ready-16': { textOffsetY: 34, screenshotScale: 100, imageOffsetY: 48 },
  'bvm-ready-17': { textPlacement: 'top' },
  'bvm-ready-20': { textPlacement: 'top', imageOffsetX: -53 },
  'bvm-ready-21': { scriptureStyle: 'minimal' },
  'bvm-ready-23': { scriptureStyle: 'minimal', textOffsetY: 33, screenshotScale: 100, imageOffsetY: 48 },
  'bvm-ready-24': { textOffsetX: 59, textOffsetY: 33 },
  'bvm-ready-25': { scriptureStyle: 'minimal', textOffsetX: 50, textOffsetY: 16, textSize: 28, screenshotScale: 100 },
  // Left 68% / Down 9% plus In 50% frames the lion face the way the shirt preview does.
  'bvm-ready-26': {
    textOffsetX: 64,
    textOffsetY: 33,
    textSize: 38,
    imageOffsetX: -68,
    imageOffsetY: 9,
    screenshotScale: 150,
    mirrorPreview: true,
  },
  'bvm-ready-27': { scriptureStyle: 'minimal', textOffsetX: 50, textOffsetY: 30, textSize: 38 },
  'bvm-ready-29': { scriptureStyle: 'minimal', textOffsetY: 26, screenshotScale: 100 },
  // Down 25% is the product preview "Move Vertical" value. In 50% matches that preview zoom.
  'bvm-ready-31': {
    scriptureStyle: 'classic',
    textPlacement: 'top',
    textOffsetX: 58,
    imageOffsetY: 25,
    screenshotScale: 150,
    mirrorPreview: true,
  },
};

export function readyMadeDesignSettings(design, template) {
  const adjustment = READY_MADE_ADJUSTMENTS[design?.id] || {};
  const textPlacement = adjustment.textPlacement || template?.recommendedTextPosition || 'center';
  const defaults = textPositionDefaults(textPlacement);
  const textOffsetX = adjustment.textOffsetX ?? defaults.offsetX;
  const textOffsetY = adjustment.textOffsetY ?? defaults.offsetY;
  const scriptureArtwork = template?.scriptureArtwork === true;
  return {
    textColor: READY_MADE_TEXT_COLOR,
    textPlacement,
    textOffsetX,
    textOffsetY,
    pinText: adjustment.textOffsetX != null || adjustment.textOffsetY != null,
    scriptureStyle: adjustment.scriptureStyle || BIBLE_VERSE_READY_MADE_STYLE.scriptureStyle,
    screenshotScale: adjustment.screenshotScale ?? 100,
    imageOffsetX: adjustment.imageOffsetX ?? 0,
    imageOffsetY: adjustment.imageOffsetY ?? 0,
    mirrorPreview: adjustment.mirrorPreview === true,
    showReference: scriptureArtwork ? false : adjustment.showReference !== false,
    scriptureArtwork,
    textEnabled: !scriptureArtwork,
    textSafeArea: defaults.safeArea,
    textSize: adjustment.textSize ?? null,
  };
}

export function readyMadePresentation(saved) {
  if (!saved || typeof saved !== 'object' || !saved.readyMadeDesignId) return saved || null;
  const design = BIBLE_VERSE_READY_MADE_DESIGNS.find((item) => item.id === saved.readyMadeDesignId);
  if (!design) return saved;
  const template = BIBLE_VERSE_TEMPLATES.find((item) => item.id === design.templateId);
  const settings = readyMadeDesignSettings(design, template);
  const verse = [...KJV_PROVERB_PRESETS, ...BIBLE_VERSE_READY_MADE_SAVED_VERSES]
    .find((item) => item.id === design.verseId);
  const cleanedVerse = verse ? { ...verse, text: readyMadeDisplayText(verse) } : null;
  const highlight = cleanedVerse ? recommendedScriptureHighlight(cleanedVerse) : (saved.scriptureHighlight || '');
  const fullText = cleanedVerse ? formatProverbDesignText(cleanedVerse) : (saved.textContent || '');
  const scriptureArtwork = settings.scriptureArtwork === true;
  return {
    ...saved,
    textColor: settings.textColor,
    textPlacement: settings.textPlacement,
    textOffsetX: settings.textOffsetX,
    textOffsetY: settings.textOffsetY,
    scriptureStyle: settings.scriptureStyle,
    screenshotScale: settings.screenshotScale,
    imageOffsetX: settings.imageOffsetX,
    imageOffsetY: settings.imageOffsetY,
    mirrorPreview: settings.mirrorPreview,
    textSafeArea: settings.textSafeArea,
    scriptureReference: scriptureArtwork || settings.showReference === false
      ? ''
      : (cleanedVerse?.reference || saved.scriptureReference || ''),
    scriptureHighlight: scriptureArtwork ? '' : (highlight || ''),
    selectedProverbId: scriptureArtwork ? '' : (verse?.id || saved.selectedProverbId),
    textContent: scriptureArtwork
      ? ''
      : (settings.scriptureStyle === 'minimal'
        ? (highlight || fullText || saved.textContent || '')
        : (fullText || saved.textContent || '')),
    textFont: BIBLE_VERSE_READY_MADE_STYLE.textFont,
    textSize: settings.textSize || saved.textSize || recommendedReadyMadeTextSize(fullText),
    textBold: true,
    textEnabled: !scriptureArtwork,
    textMaskEnabled: false,
  };
}

export function readyMadeImageFrameStyle(design) {
  if (!design?.selectedProverbTemplateId && !design?.readyMadeDesignId) return null;
  const scale = Number(design.screenshotScale);
  const zoom = Math.max(0.4, (Number.isFinite(scale) ? scale : 100) / 100);
  const offsetX = Number(design.imageOffsetX) || 0;
  const offsetY = Number(design.imageOffsetY) || 0;
  if (design.mirrorPreview) {
    const x = Math.max(0, Math.min(100, 50 + offsetX / 2));
    const y = Math.max(0, Math.min(100, 26 + offsetY / 2));
    return {
      objectFit: 'cover',
      objectPosition: `${x}% ${y}%`,
      transform: zoom === 1 ? undefined : `scale(${zoom})`,
      transformOrigin: `${x}% ${y}%`,
    };
  }
  if (zoom < 1) {
    return {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: `${zoom * 100}%`,
      height: `${zoom * 100}%`,
      objectFit: 'contain',
      transform: 'translate(-50%, -50%)',
    };
  }
  const x = Math.max(0, Math.min(100, 50 + offsetX / 2));
  return {
    objectFit: 'cover',
    objectPosition: offsetX !== 0 ? `${x}% 50%` : '50% 50%',
  };
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function readyMadeDisplayText(verse) {
  const text = String(verse?.text || '').trim();
  const reference = String(verse?.reference || '').trim();
  if (!text || !reference) return text;
  return text.replace(new RegExp(`\\s*${escapeRegExp(reference)}\\s*$`, 'i'), '').trim();
}

export function recommendedReadyMadeTextSize(text) {
  const length = String(text || '').trim().length;
  if (length > 200) return 24;
  if (length > 140) return 28;
  if (length > 95) return 32;
  return 38;
}
