export const BIBLE_VERSE_READY_MADE_STYLE = Object.freeze({
  scriptureStyle: 'highlighted',
  textFont: 'IM FELL English',
  textBold: true,
  textMaskEnabled: false,
  textMaskOpacity: 0,
});

// These owner-saved verses remain fallbacks so the ready-made shop is complete
// even if the optional storefront verse request is briefly unavailable.
export const BIBLE_VERSE_READY_MADE_SAVED_VERSES = [
  {
    id: 'saved-fc672a01ac984ae4',
    reference: 'Jeremiah 17:7',
    text: 'But blessed is the one who trusts in the Lord, whose confidence is in him.',
    preserveCase: true,
  },
  {
    id: 'saved-25e667089ee4407c',
    reference: 'Psalm 23:4',
    text: 'I will fear no evil for thou art with me.',
    preserveCase: true,
  },
  {
    id: 'saved-2ba90a3fc5f24395',
    reference: 'Romans 12:12',
    text: 'Be joyful in hope, patient in affliction, faithful in prayer.',
    preserveCase: true,
  },
  {
    id: 'saved-d910089f5c404fac',
    reference: 'Psalm 46:1',
    text: 'God is our refuge and strength, an ever present help in trouble.',
    preserveCase: true,
  },
  {
    id: 'saved-b87eb72055da4d76',
    reference: 'John 15:9',
    text: 'As the father has loved me, so have I loved you. Now remain in my love.',
    preserveCase: true,
  },
];

// Source: BibleVerse_ReadyMade_Preparation/production_pairings.csv.
// Lion and Lamb at Golden Sunset (bvm-template-30) is intentionally excluded.
export const BIBLE_VERSE_READY_MADE_DESIGNS = [
  { id: 'bvm-ready-01', templateId: 'bvm-template-01', verseId: 'proverbs-3-5-6' },
  { id: 'bvm-ready-02', templateId: 'bvm-template-02', verseId: 'proverbs-11-25' },
  { id: 'bvm-ready-03', templateId: 'bvm-template-03', verseId: 'proverbs-16-9' },
  { id: 'bvm-ready-13', templateId: 'bvm-template-13', verseId: 'proverbs-18-10' },
  { id: 'bvm-ready-14', templateId: 'bvm-template-14', verseId: 'saved-fc672a01ac984ae4' },
  { id: 'bvm-ready-16', templateId: 'bvm-template-16', verseId: 'saved-25e667089ee4407c' },
  { id: 'bvm-ready-17', templateId: 'bvm-template-17', verseId: 'saved-2ba90a3fc5f24395' },
  { id: 'bvm-ready-20', templateId: 'bvm-template-20', verseId: 'proverbs-31-30' },
  { id: 'bvm-ready-21', templateId: 'bvm-template-21', verseId: 'proverbs-27-17' },
  { id: 'bvm-ready-22', templateId: 'bvm-template-22', verseId: 'proverbs-27-19' },
  { id: 'bvm-ready-23', templateId: 'bvm-template-23', verseId: 'proverbs-14-26' },
  { id: 'bvm-ready-24', templateId: 'bvm-template-24', verseId: 'proverbs-3-7' },
  { id: 'bvm-ready-25', templateId: 'bvm-template-25', verseId: 'revelation-5-12' },
  { id: 'bvm-ready-26', templateId: 'bvm-template-26', verseId: 'proverbs-31-25' },
  { id: 'bvm-ready-27', templateId: 'bvm-template-27', verseId: 'proverbs-16-3' },
  { id: 'bvm-ready-28', templateId: 'bvm-template-28', verseId: 'saved-d910089f5c404fac' },
  { id: 'bvm-ready-29', templateId: 'bvm-template-29', verseId: 'saved-2ba90a3fc5f24395' },
  { id: 'bvm-ready-31', templateId: 'bvm-template-31', verseId: 'saved-b87eb72055da4d76' },
  { id: 'bvm-ready-32', templateId: 'bvm-template-32', verseId: 'proverbs-17-22' },
];

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
