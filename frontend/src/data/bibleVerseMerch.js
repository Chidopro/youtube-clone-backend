export const BIBLE_VERSE_MERCH_SUBDOMAIN = 'bibleversemerch';

const TEMPLATE_TITLES = [
  ['mountain-sunrise', 'Mountain Sunrise', 'top'],
  ['peaceful-river', 'Peaceful River', 'top'],
  ['sunlit-forest-path', 'Sunlit Forest Path', 'center'],
  ['still-waters', 'Still Waters', 'top'],
  ['wildflower-meadow', 'Wildflower Meadow', 'top'],
  ['olive-branches', 'Olive Branches', 'center'],
  ['garden-at-dawn', 'Garden at Dawn', 'top'],
  ['golden-wheat-field', 'Golden Wheat Field', 'top'],
  ['green-waterfall', 'Green Waterfall', 'bottom'],
  ['rays-over-meadow', 'Rays Over the Meadow', 'center'],
  ['ancient-stone-path', 'Ancient Stone Path', 'top'],
  ['cedars-and-sky', 'Cedars and Sky', 'center'],
  ['ocean-sunrise', 'Ocean Sunrise', 'top'],
  ['mountain-lake', 'Mountain Lake', 'center'],
  ['desert-in-bloom', 'Desert in Bloom', 'top'],
  ['shepherd-country', 'Shepherd Country', 'top'],
  ['dove-in-clouds', 'Dove in the Clouds', 'bottom'],
  ['mustard-tree', 'Mustard Tree', 'top'],
  ['vineyard-morning', 'Vineyard Morning', 'top'],
  ['cross-of-light', 'Cross of Light', 'bottom'],
];

const SAFE_AREAS = {
  top: { x: 5, y: 5, width: 90, height: 48 },
  center: { x: 10, y: 30, width: 80, height: 40 },
  bottom: { x: 10, y: 58, width: 80, height: 35 },
};

export const BIBLE_VERSE_TEMPLATES = TEMPLATE_TITLES.map(
  ([slug, title, recommendedTextPosition], index) => ({
    id: `bvm-template-${String(index + 1).padStart(2, '0')}`,
    imageUrl: `/proverb-templates/${String(index + 1).padStart(2, '0')}-${slug}.png`,
    title,
    recommendedTextPosition,
    recommendedTextSafeArea: SAFE_AREAS[recommendedTextPosition],
    recommendedTextColor: index === 0
      ? '#6f42c1'
      : (recommendedTextPosition === 'bottom' ? '#fff8e6' : '#30291f'),
    recommendedMaskColor: recommendedTextPosition === 'bottom' ? 'charcoal' : 'cream',
    recommendedMaskOpacity: 0,
  })
);

export const KJV_PROVERB_PRESETS = [
  {
    id: 'proverbs-3-5-6',
    reference: 'Proverbs 3:5–6',
    text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.\nIn all thy ways acknowledge him, and he shall direct thy paths.',
  },
  {
    id: 'proverbs-16-3',
    reference: 'Proverbs 16:3',
    text: 'Commit thy works unto the LORD, and thy thoughts shall be established.',
  },
  {
    id: 'proverbs-18-10',
    reference: 'Proverbs 18:10',
    text: 'The name of the LORD is a strong tower: the righteous runneth into it, and is safe.',
  },
  {
    id: 'proverbs-4-23',
    reference: 'Proverbs 4:23',
    text: 'Keep thy heart with all diligence; for out of it are the issues of life.',
  },
  {
    id: 'proverbs-17-22',
    reference: 'Proverbs 17:22',
    text: 'A merry heart doeth good like a medicine: but a broken spirit drieth the bones.',
  },
  {
    id: 'proverbs-15-1',
    reference: 'Proverbs 15:1',
    text: 'A soft answer turneth away wrath: but grievous words stir up anger.',
  },
  {
    id: 'proverbs-27-17',
    reference: 'Proverbs 27:17',
    text: 'Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.',
  },
  {
    id: 'proverbs-16-9',
    reference: 'Proverbs 16:9',
    text: "A man's heart deviseth his way: but the LORD directeth his steps.",
  },
  {
    id: 'proverbs-31-25',
    reference: 'Proverbs 31:25',
    text: 'Strength and honour are her clothing; and she shall rejoice in time to come.',
  },
  {
    id: 'proverbs-3-7',
    reference: 'Proverbs 3:7',
    text: 'Be not wise in thine own eyes: fear the LORD, and depart from evil.',
  },
  {
    id: 'proverbs-11-25',
    reference: 'Proverbs 11:25',
    text: 'The liberal soul shall be made fat: and he that watereth shall be watered also himself.',
  },
  {
    id: 'proverbs-12-25',
    reference: 'Proverbs 12:25',
    text: 'Heaviness in the heart of man maketh it stoop: but a good word maketh it glad.',
  },
  {
    id: 'proverbs-13-20',
    reference: 'Proverbs 13:20',
    text: 'He that walketh with wise men shall be wise: but a companion of fools shall be destroyed.',
  },
  {
    id: 'proverbs-14-26',
    reference: 'Proverbs 14:26',
    text: 'In the fear of the LORD is strong confidence: and his children shall have a place of refuge.',
  },
  {
    id: 'proverbs-16-24',
    reference: 'Proverbs 16:24',
    text: 'Pleasant words are as an honeycomb, sweet to the soul, and health to the bones.',
  },
  {
    id: 'proverbs-18-21',
    reference: 'Proverbs 18:21',
    text: 'Death and life are in the power of the tongue: and they that love it shall eat the fruit thereof.',
  },
  {
    id: 'proverbs-19-21',
    reference: 'Proverbs 19:21',
    text: "There are many devices in a man's heart; nevertheless the counsel of the LORD, that shall stand.",
  },
  {
    id: 'proverbs-22-6',
    reference: 'Proverbs 22:6',
    text: 'Train up a child in the way he should go: and when he is old, he will not depart from it.',
  },
  {
    id: 'proverbs-27-19',
    reference: 'Proverbs 27:19',
    text: 'As in water face answereth to face, so the heart of man to man.',
  },
  {
    id: 'proverbs-31-30',
    reference: 'Proverbs 31:30',
    text: 'Favour is deceitful, and beauty is vain: but a woman that feareth the LORD, she shall be praised.',
  },
];

export function formatProverbDesignText(preset) {
  if (!preset) return '';
  const verse = String(preset.text || '')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .trim();
  const reference = String(preset.reference || '').trim();
  return [verse, reference].filter(Boolean).join('\n');
}

export function isBibleVerseMerchStorefront(subdomain) {
  return String(subdomain || '').trim().toLowerCase() === BIBLE_VERSE_MERCH_SUBDOMAIN;
}

export function textPositionDefaults(position) {
  const normalized = ['top', 'bottom'].includes(position) ? position : 'center';
  return {
    position: normalized,
    offsetX: 50,
    offsetY: normalized === 'top' ? 24 : normalized === 'bottom' ? 76 : 50,
    safeArea: SAFE_AREAS[normalized],
  };
}
