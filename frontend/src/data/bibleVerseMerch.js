export const BIBLE_VERSE_MERCH_SUBDOMAIN = 'bibleversemerch';

const TEMPLATE_TITLES = [
  ['mountain-sunrise', 'Mountain Sunrise', 'top'],
  ['rivers-of-living-water', 'Rivers of Living Water', 'top'],
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
  ['ocean-sunrise', 'Golden Horizon Lighthouse', 'top'],
  ['mountain-lake', 'Mountain Lake', 'center'],
  ['desert-in-bloom', 'Desert in Bloom', 'top'],
  ['shepherd-country', 'Shepherd Country', 'top'],
  ['dove-in-clouds', 'Heavenly Dove', 'bottom'],
  ['mustard-tree', 'Mustard Tree', 'top'],
  ['vineyard-morning', 'Vineyard Morning', 'top'],
  ['cross-of-light', 'Cross of Light', 'bottom'],
  ['blacksmith-forge', 'Blacksmith Forge', 'top', '#fff8e6', 'charcoal'],
  ['radiant-mountain-reflection', 'Radiant Mountain Reflection', 'top', '#fff8e6', 'charcoal'],
  ['rusty-anchor-golden-sunrise', 'Rusty Anchor at Golden Sunrise', 'top', '#fff8e6', 'charcoal'],
  ['open-bible-mountain-lake', 'Open Bible Over a Golden Mountain Lake', 'top', '#fff8e6', 'charcoal'],
  ['majestic-lion', 'Majestic Lion', 'top', '#fff8e6', 'charcoal'],
  ['lion-golden-shadow', 'Majestic Lion in Golden Shadow', 'center', '#fff8e6', 'charcoal'],
  ['golden-light-rustic-workshop', 'Golden Light in the Rustic Workshop', 'center', '#fff8e6', 'charcoal'],
  ['rusty-anchor-stormy-sunbeams', 'Rusty Anchor Beneath Stormy Sunbeams', 'top', '#fff8e6', 'charcoal'],
  ['sunrise-empty-tomb', 'Sunrise Beyond the Empty Tomb', 'top', '#fff8e6', 'charcoal'],
  ['lion-lamb-golden-sunset', 'Lion and Lamb at Golden Sunset', 'top', '#fff8e6', 'charcoal'],
  ['guiding-star-nativity', 'Guiding Star Over the Nativity', 'bottom', '#fff8e6', 'charcoal'],
  ['jesus-healing-pool', 'Jesus Healing by the Pool', 'bottom', '#fff8e6', 'charcoal'],
  ['rivers-of-living-water-woman', 'Rivers of Living Water II', 'top'],
  ['worthy-is-the-lamb', 'Worthy Is the Lamb', 'top'],
  ['peaceful-kingdom', 'Peaceful Kingdom', 'top'],
  ['trust-in-the-lord', 'Trust in the Lord', 'top'],
  ['strong-tower', 'A Strong Tower', 'top'],
  ['keep-thy-heart', 'Keep Thy Heart', 'top'],
  ['merry-heart', 'A Merry Heart', 'top'],
  ['merry-heart-ii', 'A Merry Heart II', 'top'],
  ['soft-answer', 'A Soft Answer', 'top'],
  ['iron-sharpeneth-iron', 'Iron Sharpeneth Iron', 'top'],
  ['directeth-his-steps', 'Directeth His Steps', 'top'],
  ['strength-and-honor', 'Strength and Honor', 'top'],
  ['strength-and-honor-ii', 'Strength and Honor II', 'top'],
  ['strength-and-honor-iii', 'Strength and Honor III', 'top'],
  ['rivers-of-living-water-iii', 'Rivers of Living Water III', 'top'],
  ['keep-thy-heart-ii', 'Keep Thy Heart II', 'top'],
  ['iron-sharpeneth-iron-ii', 'Iron Sharpeneth Iron II', 'top'],
  ['directeth-his-steps-ii', 'Directeth His Steps II', 'top'],
  ['strong-tower-ii', 'A Strong Tower II', 'top'],
  ['strength-and-honor-iv', 'Strength and Honor IV', 'top'],
];

const SAFE_AREAS = {
  top: { x: 5, y: 5, width: 90, height: 48 },
  center: { x: 10, y: 30, width: 80, height: 40 },
  bottom: { x: 10, y: 58, width: 80, height: 35 },
};

const FULL_FRAME_REPLACEMENTS = new Set([
  'mountain-sunrise',
  'sunlit-forest-path',
  'mountain-lake',
]);

// These posters already include the verse, so the shop must not draw it again.
const SCRIPTURE_ARTWORK = {
  'rivers-of-living-water': 'John 7:38',
  'rivers-of-living-water-woman': 'John 7:38',
  'worthy-is-the-lamb': 'Revelation 5:12',
  'peaceful-kingdom': 'Isaiah 11:6',
  'trust-in-the-lord': 'Proverbs 3:5–6',
  'strong-tower': 'Proverbs 18:10',
  'keep-thy-heart': 'Proverbs 4:23',
  'merry-heart': 'Proverbs 17:22',
  'merry-heart-ii': 'Proverbs 17:22',
  'soft-answer': 'Proverbs 15:1',
  'iron-sharpeneth-iron': 'Proverbs 27:17',
  'directeth-his-steps': 'Proverbs 16:9',
  'strength-and-honor': 'Proverbs 31:25',
  'strength-and-honor-ii': 'Proverbs 31:25',
  'strength-and-honor-iii': 'Proverbs 31:25',
  'rivers-of-living-water-iii': 'John 7:38',
  'keep-thy-heart-ii': 'Proverbs 4:23',
  'iron-sharpeneth-iron-ii': 'Proverbs 27:17',
  'directeth-his-steps-ii': 'Proverbs 16:9',
  'strong-tower-ii': 'Proverbs 18:10',
  'strength-and-honor-iv': 'Proverbs 31:25',
};

const WIDE_SCRIPTURE_ARTWORK = new Set([
  'directeth-his-steps-ii',
]);

const SHOP_LEAD_TEMPLATE_IDS = [
  'bvm-template-47',
  'bvm-template-48',
  'bvm-template-49',
  'bvm-template-50',
  'bvm-template-51',
  'bvm-template-52',
  'bvm-template-41',
  'bvm-template-42',
  'bvm-template-43',
  'bvm-template-44',
  'bvm-template-45',
  'bvm-template-46',
  'bvm-template-34',
  'bvm-template-35',
  'bvm-template-36',
  'bvm-template-37',
  'bvm-template-38',
  'bvm-template-39',
  'bvm-template-40',
];

export const BIBLE_VERSE_TEMPLATES = TEMPLATE_TITLES.map(
  ([slug, title, recommendedTextPosition, textColorOverride, maskColorOverride], index) => ({
    id: `bvm-template-${String(index + 1).padStart(2, '0')}`,
    imageUrl: `/proverb-templates/${String(index + 1).padStart(2, '0')}-${slug}.${
      SCRIPTURE_ARTWORK[slug] ? 'jpg' : 'png'
    }${FULL_FRAME_REPLACEMENTS.has(slug) ? '?v=2' : ''}`,
    title,
    scriptureArtwork: Boolean(SCRIPTURE_ARTWORK[slug]),
    wideArtwork: WIDE_SCRIPTURE_ARTWORK.has(slug),
    includedReference: SCRIPTURE_ARTWORK[slug] || '',
    recommendedTextPosition,
    recommendedTextSafeArea: SAFE_AREAS[recommendedTextPosition],
    recommendedTextColor: textColorOverride
      || (recommendedTextPosition === 'bottom' ? '#fff8e6' : '#30291f'),
    recommendedMaskColor: maskColorOverride
      || (recommendedTextPosition === 'bottom' ? 'charcoal' : 'cream'),
    recommendedMaskOpacity: 0,
  })
);

export function displayBibleVerseTemplates(templates = []) {
  const byId = new Map(templates.map((template) => [template.id, template]));
  const lead = SHOP_LEAD_TEMPLATE_IDS.map((id) => byId.get(id)).filter(Boolean);
  const rest = templates.filter((template) => (
    !SHOP_LEAD_TEMPLATE_IDS.includes(template.id) && template.id !== 'bvm-template-33'
  ));
  const follow = byId.get('bvm-template-33');
  const leadIndex = rest.findIndex((template) => template.id === 'bvm-template-02');
  const paired = !follow
    ? rest
    : (leadIndex < 0
      ? [...rest, follow]
      : [
        ...rest.slice(0, leadIndex + 1),
        follow,
        ...rest.slice(leadIndex + 1),
      ]);
  return [...lead, ...paired];
}

export function applyBibleVerseTemplateSettings(
  templates = BIBLE_VERSE_TEMPLATES,
  settings = {}
) {
  const hidden = new Set(settings.hidden_template_ids || []);
  const overrides = settings.template_overrides || {};
  return templates
    .filter((template) => !hidden.has(template.id))
    .map((template) => {
      const override = overrides[template.id] || {};
      const position = ['top', 'center', 'bottom'].includes(override.recommendedTextPosition)
        ? override.recommendedTextPosition
        : template.recommendedTextPosition;
      return {
        ...template,
        title: String(override.title || '').trim() || template.title,
        imageUrl: String(override.imageUrl || '').trim() || template.imageUrl,
        recommendedTextPosition: position,
        recommendedTextSafeArea: SAFE_AREAS[position],
      };
    });
}

export const KJV_PROVERB_PRESETS = [
  {
    id: 'revelation-5-12',
    reference: 'Revelation 5:12',
    text: 'Saying with a loud voice, Worthy is the Lamb that was slain to receive power, and riches, and wisdom, and strength, and honour, and glory, and blessing.',
    highlight: 'Worthy is the Lamb',
    preserveCase: true,
    cleanShopText: true,
  },
  {
    id: 'isaiah-11-6',
    reference: 'Isaiah 11:6',
    text: 'The wolf also shall dwell with the lamb, and the leopard shall lie down with the kid; and the calf and the young lion and the fatling together; and a little child shall lead them.',
    highlight: 'The wolf also shall dwell with the lamb',
  },
  {
    id: 'proverbs-3-5-6',
    reference: 'Proverbs 3:5–6',
    text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.\nIn all thy ways acknowledge him, and he shall direct thy paths.',
    cleanShopText: true,
  },
  {
    id: 'proverbs-16-3',
    reference: 'Proverbs 16:3',
    text: 'Commit thy works unto the LORD, and thy thoughts shall be established.',
    cleanShopText: true,
  },
  {
    id: 'proverbs-18-10',
    reference: 'Proverbs 18:10',
    text: 'The name of the LORD is a strong tower: the righteous runneth into it, and is safe.',
    cleanShopText: true,
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
    cleanShopText: true,
  },
  {
    id: 'proverbs-16-9',
    reference: 'Proverbs 16:9',
    text: "A man's heart deviseth his way: but the LORD directeth his steps.",
    cleanShopText: true,
  },
  {
    id: 'proverbs-31-25',
    reference: 'Proverbs 31:25',
    text: 'Strength and honour are her clothing; and she shall rejoice in time to come.',
    cleanShopText: true,
  },
  {
    id: 'proverbs-3-7',
    reference: 'Proverbs 3:7',
    text: 'Be not wise in thine own eyes: fear the LORD, and depart from evil.',
    cleanShopText: true,
  },
  {
    id: 'proverbs-11-25',
    reference: 'Proverbs 11:25',
    text: 'The liberal soul shall be made fat: and he that watereth shall be watered also himself.',
    cleanShopText: true,
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
    cleanShopText: true,
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
    cleanShopText: true,
  },
  {
    id: 'proverbs-31-30',
    reference: 'Proverbs 31:30',
    text: 'Favour is deceitful, and beauty is vain: but a woman that feareth the LORD, she shall be praised.',
    cleanShopText: true,
  },
  {
    id: 'luke-4-23',
    reference: 'Luke 4:23',
    text: 'Physician, heal thyself',
    highlight: 'Physician, heal thyself',
    preserveCase: true,
    keepPunctuation: true,
  },
  {
    id: 'john-11-25',
    reference: 'John 11:25',
    text: 'I am the resurrection and the life. Whoever believes in me, though he die, yet shall he live.',
    highlight: 'I am the resurrection and the life',
    preserveCase: true,
    keepPunctuation: true,
  },
  {
    id: '2-corinthians-9-15',
    reference: '2 Corinthians 9:15',
    text: 'Thanks be unto God for his unspeakable gift.',
    highlight: 'Thanks be unto God for his unspeakable gift',
    preserveCase: true,
    keepPunctuation: true,
  },
  {
    id: 'john-7-38',
    reference: 'John 7:38',
    text: 'Whoever believes in me, as Scripture has said, rivers of living water will flow from within them.',
    highlight: 'Whoever believes in me, as Scripture has said, rivers of living water will flow from within them.',
    preserveCase: true,
    keepPunctuation: true,
  },
  {
    id: 'psalm-119-105',
    reference: 'Psalm 119:105',
    text: 'Your word is a lamp for my feet, a light on my path.',
    highlight: 'Your word is a lamp for my feet, a light on my path.',
    preserveCase: true,
    keepPunctuation: true,
  },
  {
    id: 'isaiah-41-18',
    reference: 'Isaiah 41:18',
    text: 'I will make the wilderness a pool of water, and the dry land springs of water.',
    highlight: 'I will make the wilderness a pool of water, and the dry land springs of water.',
    preserveCase: true,
    keepPunctuation: true,
  },
  {
    id: 'luke-14-27',
    reference: 'Luke 14:27',
    text: 'And whoever does not carry their cross and follow me cannot be my disciple.',
    highlight: 'And whoever does not carry their cross and follow me cannot be my disciple.',
    preserveCase: true,
    keepPunctuation: true,
  },
  {
    id: 'psalm-36-6',
    reference: 'Psalm 36:6',
    text: 'Your righteousness is like the highest mountains, your justice like the great deep.',
    highlight: 'Your righteousness is like the highest mountains, your justice like the great deep.',
    preserveCase: true,
    keepPunctuation: true,
  },
  {
    id: 'hebrews-6-18',
    reference: 'Hebrews 6:18',
    text: 'We have this hope as an anchor for the soul, firm and secure.',
    highlight: 'We have this hope as an anchor for the soul, firm and secure.',
    preserveCase: true,
    keepPunctuation: true,
  },
  {
    id: '1-corinthians-15-58',
    reference: '1 Corinthians 15:58',
    text: 'Stand firm. Let nothing move you.',
    highlight: 'Stand firm. Let nothing move you.',
    preserveCase: true,
    keepPunctuation: true,
  },
];

function honorSpelling(text) {
  return String(text || '').replace(/\bhonour\b/gi, (word) => {
    if (word === word.toUpperCase()) return 'HONOR';
    return word[0] === 'H' ? 'Honor' : 'honor';
  });
}

function collapseVerseSpace(text) {
  return String(text || '').replace(/[^\S\n]{2,}/g, ' ').replace(/ *\n */g, '\n').trim();
}

function stripShopPunctuation(text) {
  return collapseVerseSpace(String(text || '').replace(/[^\S\n]*[,:;][^\S\n]*/g, ' '));
}

function titleCaseVerse(text) {
  return String(text || '').replace(
    /(^|[^A-Za-z0-9'])([a-z])/g,
    (_, lead, letter) => lead + letter.toUpperCase()
  );
}

export function formatProverbDesignText(preset) {
  if (!preset) return '';
  let text = honorSpelling(String(preset.text || '').replace(/\s*;\s*/g, ', ')).trim();
  text = preset.cleanShopText && !preset.keepPunctuation
    ? stripShopPunctuation(text)
    : collapseVerseSpace(text);
  return preset.preserveCase ? text : titleCaseVerse(text);
}

export function recommendedScriptureHighlight(preset) {
  const explicit = String(preset?.highlight || '').trim();
  if (explicit) return formatProverbDesignText({ ...preset, text: explicit });
  const verse = formatProverbDesignText({ ...preset, cleanShopText: false });
  const firstClause = verse.split(/[,:;.!?]/)[0]?.trim() || verse;
  return firstClause.split(/\s+/).slice(0, 10).join(' ');
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
