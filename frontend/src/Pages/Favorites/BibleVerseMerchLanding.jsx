import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BIBLE_VERSE_MERCH_SUBDOMAIN,
  BIBLE_VERSE_TEMPLATES,
  formatProverbDesignText,
  KJV_PROVERB_PRESETS,
  recommendedScriptureHighlight,
  textPositionDefaults,
} from '../../data/bibleVerseMerch';
import { fetchStorefrontBibleVerses, mergeBibleVersePresets } from '../../utils/bibleVersesApi';
import { markMerchIntentStarted, savePendingMerchData } from '../../utils/merchSession';
import './BibleVerseMerchLanding.css';

const CUSTOM_ID = 'custom';
const FEATURED_HOMEPAGE_TEMPLATE_ID = 'bvm-template-30';
const FEATURED_HOMEPAGE_VERSE_ID = 'revelation-5-12';
const FEATURED_HOMEPAGE_TEXT_COLOR = '#ffffff';
const FEATURED_HOMEPAGE_MASK_OPACITY = 0;

export default function BibleVerseMerchLanding() {
  const navigate = useNavigate();
  const [availableTemplateIds, setAvailableTemplateIds] = useState([]);
  const [templateId, setTemplateId] = useState(FEATURED_HOMEPAGE_TEMPLATE_ID);
  const [proverbId, setProverbId] = useState(FEATURED_HOMEPAGE_VERSE_ID);
  const [customText, setCustomText] = useState('');
  const [proverbPresets, setProverbPresets] = useState(KJV_PROVERB_PRESETS);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      BIBLE_VERSE_TEMPLATES.map((template) => new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(template.id);
        image.onerror = () => resolve('');
        image.src = template.imageUrl;
      }))
    ).then((ids) => {
      if (cancelled) return;
      const available = ids.filter(Boolean);
      setAvailableTemplateIds(available);
      if (available.length && !available.includes(templateId)) setTemplateId(available[0]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchStorefrontBibleVerses(BIBLE_VERSE_MERCH_SUBDOMAIN).then(({ ok, data }) => {
      if (!cancelled && ok) {
        setProverbPresets(mergeBibleVersePresets(KJV_PROVERB_PRESETS, data.verses));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const templates = useMemo(
    () => BIBLE_VERSE_TEMPLATES.filter((template) => availableTemplateIds.includes(template.id)),
    [availableTemplateIds]
  );
  const template = BIBLE_VERSE_TEMPLATES.find((item) => item.id === templateId)
    || BIBLE_VERSE_TEMPLATES[0];
  const showFeaturedHomepageText = template?.id === FEATURED_HOMEPAGE_TEMPLATE_ID;
  const featuredHomepageDesign = showFeaturedHomepageText && proverbId === FEATURED_HOMEPAGE_VERSE_ID;
  const proverb = proverbPresets.find((item) => item.id === proverbId);
  const selectedText = proverbId === CUSTOM_ID
    ? customText.trim()
    : String(proverb?.text || '').replace(/\s*;\s*/g, ', ');
  const designText = proverbId === CUSTOM_ID ? selectedText : formatProverbDesignText(proverb);
  const displayText = selectedText || 'Enter your own message';

  const startDesign = () => {
    if (!template || !selectedText) return;
    const placement = textPositionDefaults(template.recommendedTextPosition);
    markMerchIntentStarted();
    savePendingMerchData({
      source: 'image',
      selected_screenshot: new URL(template.imageUrl, window.location.origin).toString(),
      display_screenshot: template.imageUrl,
      screenshots: [template.imageUrl],
      thumbnail: template.imageUrl,
      videoTitle: template.title,
      creatorName: 'Bible Verse Merch',
      screenshot_timestamp: '0:00',
      bibleVerseDesign: {
        bibleVerseDesignVersion: 19,
        imageOpacity: 100,
        textEnabled: !featuredHomepageDesign,
        textContent: featuredHomepageDesign ? '' : designText,
        scriptureStyle: 'classic',
        scriptureReference: featuredHomepageDesign ? '' : (proverb?.reference || ''),
        scriptureHighlight: featuredHomepageDesign ? '' : recommendedScriptureHighlight(proverb),
        textFont: 'IM FELL English',
        textBold: true,
        textColor: featuredHomepageDesign
          ? FEATURED_HOMEPAGE_TEXT_COLOR
          : template.recommendedTextColor,
        textSize: featuredHomepageDesign ? 70 : 38,
        textOffsetX: placement.offsetX,
        textOffsetY: placement.offsetY,
        textDirection: 'horizontal',
        textMaskEnabled: !featuredHomepageDesign,
        textMaskOpacity: featuredHomepageDesign
          ? FEATURED_HOMEPAGE_MASK_OPACITY
          : template.recommendedMaskOpacity,
        textMaskColor: featuredHomepageDesign
          ? 'cream'
          : template.recommendedMaskColor,
        screenshotScale: 150,
        textPlacement: placement.position,
        textSafeArea: template.recommendedTextSafeArea,
        selectedProverbId: featuredHomepageDesign || proverbId === CUSTOM_ID ? '' : proverbId,
        selectedProverbTemplateId: template.id,
      },
    });
    navigate('/merchandise');
    window.scrollTo(0, 0);
  };

  return (
    <main className="bvm-landing">
      <header className="bvm-heading">
        <p className="bvm-eyebrow">Bible Verse Merch</p>
        <h1>Create merchandise with a message</h1>
        <p>Choose an image and a proverb, then select the product you want to customize.</p>
      </header>

      <div className="bvm-builder">
        <section className="bvm-preview-panel" aria-label="Design preview">
          <div className={`bvm-preview${template?.id === 'bvm-template-23' ? ' bvm-preview--full-image' : ''}${
            featuredHomepageDesign ? ' bvm-preview--featured-zoom' : ''
          }`}>
            {template ? <img src={template.imageUrl} alt={template.title} /> : null}
            {showFeaturedHomepageText ? (
              <div className={`bvm-preview-copy bvm-preview-copy--${template?.recommendedTextPosition || 'center'}${
                featuredHomepageDesign ? ' bvm-preview-copy--featured' : ''
              }`}>
                <div
                  className={`bvm-preview-mask bvm-preview-mask--${
                    featuredHomepageDesign ? 'cream' : (template?.recommendedMaskColor || 'cream')
                  }${featuredHomepageDesign ? ' bvm-preview-mask--featured' : ''}`}
                  style={{ color: featuredHomepageDesign ? FEATURED_HOMEPAGE_TEXT_COLOR : template.recommendedTextColor }}
                >
                  {featuredHomepageDesign ? (
                    <>
                      <span className="bvm-preview-scripture-body">Saying with a loud voice,</span>
                      <span className="bvm-preview-scripture-highlight">
                        Worthy is the<br />Lamb
                      </span>
                      <span className="bvm-preview-scripture-body">
                        that was slain to receive power, and riches, and wisdom, and strength,
                        and honour, and glory, and blessing.
                      </span>
                    </>
                  ) : (
                    <span>{displayText}</span>
                  )}
                  {proverb?.reference ? <strong>{proverb.reference}</strong> : null}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="bvm-controls" aria-label="Choose image and text">
          <label htmlFor="bvm-template">Image template</label>
          <select id="bvm-template" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            {templates.length ? templates.map((item) => (
              <option value={item.id} key={item.id}>{item.title}</option>
            )) : <option value={templateId}>Loading template…</option>}
          </select>

          <label htmlFor="bvm-proverb">Proverb or custom text</label>
          <select id="bvm-proverb" value={proverbId} onChange={(event) => setProverbId(event.target.value)}>
            {proverbPresets.map((item) => (
              <option value={item.id} key={item.id}>{item.reference}</option>
            ))}
            <option value={CUSTOM_ID}>Write my own text</option>
          </select>

          {proverbId === CUSTOM_ID ? (
            <textarea
              value={customText}
              onChange={(event) => setCustomText(event.target.value)}
              placeholder="Enter the words you want on your design"
              rows={5}
              maxLength={500}
            />
          ) : null}

          <button type="button" onClick={startDesign} disabled={!template || !selectedText}>
            Select a Product
          </button>
          <p className="bvm-help">You can adjust the text, mask, placement, and image in Tools after selecting a product.</p>
        </section>
      </div>
    </main>
  );
}
