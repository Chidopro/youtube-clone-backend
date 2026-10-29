import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BIBLE_VERSE_MERCH_SUBDOMAIN,
  applyBibleVerseTemplateSettings,
  BIBLE_VERSE_TEMPLATES,
  formatProverbDesignText,
  KJV_PROVERB_PRESETS,
  recommendedScriptureHighlight,
  textPositionDefaults,
} from '../../data/bibleVerseMerch';
import { fetchStorefrontBibleVerses, mergeBibleVersePresets } from '../../utils/bibleVersesApi';
import { fetchPlatformStorefrontDashboard } from '../../utils/platformStorefrontDashboardApi';
import { markMerchIntentStarted, savePendingMerchData } from '../../utils/merchSession';
import ScriptureThumbCaption from '../../Components/ScriptureThumbCaption/ScriptureThumbCaption';
import './BibleVerseMerchLanding.css';

const CUSTOM_ID = 'custom';
const FEATURED_HOMEPAGE_TEMPLATE_ID = 'bvm-template-30';
const FEATURED_HOMEPAGE_VERSE_ID = 'revelation-5-12';
const FEATURED_HOMEPAGE_TEXT_COLOR = '#ffffff';

export default function BibleVerseMerchLanding() {
  const navigate = useNavigate();
  const [availableTemplateIds, setAvailableTemplateIds] = useState([]);
  const [templateId, setTemplateId] = useState(FEATURED_HOMEPAGE_TEMPLATE_ID);
  const [proverbId, setProverbId] = useState(FEATURED_HOMEPAGE_VERSE_ID);
  const [customText, setCustomText] = useState('');
  const [proverbPresets, setProverbPresets] = useState(KJV_PROVERB_PRESETS);
  const [templateCatalog, setTemplateCatalog] = useState(BIBLE_VERSE_TEMPLATES);
  const [proverbMenuOpen, setProverbMenuOpen] = useState(false);
  const [hoveredProverbId, setHoveredProverbId] = useState('');
  const [hoveredProverbTop, setHoveredProverbTop] = useState(0);
  const proverbPickerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      templateCatalog.map((template) => new Promise((resolve) => {
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
  }, [templateCatalog]);

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

  useEffect(() => {
    let cancelled = false;
    fetchPlatformStorefrontDashboard(BIBLE_VERSE_MERCH_SUBDOMAIN).then(({ ok, data }) => {
      if (!cancelled && ok) {
        setTemplateCatalog(applyBibleVerseTemplateSettings(
          BIBLE_VERSE_TEMPLATES,
          data.settings || {}
        ));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const templates = useMemo(
    () => templateCatalog.filter((template) => availableTemplateIds.includes(template.id)),
    [availableTemplateIds, templateCatalog]
  );
  const template = templateCatalog.find((item) => item.id === templateId)
    || templateCatalog[0];
  const showFeaturedHomepageText = template?.id === FEATURED_HOMEPAGE_TEMPLATE_ID;
  const featuredHomepageDesign = showFeaturedHomepageText && proverbId === FEATURED_HOMEPAGE_VERSE_ID;
  const proverb = proverbPresets.find((item) => item.id === proverbId);
  const hoveredProverb = proverbPresets.find((item) => item.id === hoveredProverbId);

  useEffect(() => {
    if (!proverbMenuOpen) return undefined;
    const close = (event) => {
      if (!proverbPickerRef.current?.contains(event.target)) setProverbMenuOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setProverbMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [proverbMenuOpen]);

  const showProverbPreview = (itemId, row) => {
    setHoveredProverbId(itemId);
    const picker = proverbPickerRef.current;
    if (!picker || !row) return;
    const top = row.getBoundingClientRect().top - picker.getBoundingClientRect().top;
    setHoveredProverbTop(Math.max(0, top));
  };
  const selectedText = proverbId === CUSTOM_ID
    ? customText.trim()
    : String(proverb?.text || '').replace(/\s*;\s*/g, ', ');
  const designText = proverbId === CUSTOM_ID ? selectedText : formatProverbDesignText(proverb);

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
        bibleVerseDesignVersion: 20,
        imageOpacity: 100,
        textEnabled: true,
        textContent: designText,
        scriptureStyle: 'classic',
        scriptureReference: proverb?.reference || '',
        scriptureHighlight: recommendedScriptureHighlight(proverb),
        textFont: 'IM FELL English',
        textBold: true,
        textColor: template.recommendedTextColor,
        textSize: 38,
        textOffsetX: placement.offsetX,
        textOffsetY: placement.offsetY,
        textDirection: 'horizontal',
        textMaskEnabled: !featuredHomepageDesign,
        textMaskOpacity: template.recommendedMaskOpacity,
        textMaskColor: template.recommendedMaskColor,
        screenshotScale: 150,
        textPlacement: placement.position,
        textSafeArea: template.recommendedTextSafeArea,
        selectedProverbId: proverbId === CUSTOM_ID ? '' : proverbId,
        selectedProverbTemplateId: template.id,
        homepageFeaturedLayout: featuredHomepageDesign,
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
            {featuredHomepageDesign ? (
              <div className="bvm-preview-copy bvm-preview-copy--top bvm-preview-copy--featured">
                <div
                  className="bvm-preview-mask bvm-preview-mask--cream bvm-preview-mask--featured"
                  style={{ color: FEATURED_HOMEPAGE_TEXT_COLOR }}
                >
                  <span className="bvm-preview-scripture-body">Saying with a loud voice,</span>
                  <span className="bvm-preview-scripture-highlight">
                    Worthy is the<br />Lamb
                  </span>
                  <span className="bvm-preview-scripture-body">
                    that was slain to receive power, and riches, and wisdom, and strength,
                    and honour, and glory, and blessing.
                  </span>
                  {proverb?.reference ? <strong>{proverb.reference}</strong> : null}
                </div>
              </div>
            ) : designText ? (
              <ScriptureThumbCaption
                text={designText}
                reference={proverb?.reference || ''}
                color={template?.recommendedTextColor || '#fff8e6'}
                position={template?.recommendedTextPosition || 'center'}
                mask={template?.recommendedMaskColor || 'cream'}
              />
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
          <div className="bvm-proverb-picker" ref={proverbPickerRef}>
            <button
              id="bvm-proverb"
              type="button"
              className="bvm-proverb-trigger"
              aria-haspopup="listbox"
              aria-expanded={proverbMenuOpen}
              onClick={() => setProverbMenuOpen((open) => !open)}
            >
              {proverbId === CUSTOM_ID ? 'Write my own text' : (proverb?.reference || 'Choose a proverb')}
            </button>
            {proverbMenuOpen ? (
              <div className="bvm-proverb-menu" role="listbox" aria-label="Proverbs">
                {proverbPresets.map((item) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={proverbId === item.id}
                    className={proverbId === item.id ? 'is-selected' : ''}
                    key={item.id}
                    onMouseEnter={(event) => showProverbPreview(item.id, event.currentTarget)}
                    onFocus={(event) => showProverbPreview(item.id, event.currentTarget)}
                    onClick={() => {
                      setProverbId(item.id);
                      setProverbMenuOpen(false);
                    }}
                  >
                    {item.reference}
                  </button>
                ))}
                <button
                  type="button"
                  role="option"
                  aria-selected={proverbId === CUSTOM_ID}
                  className={proverbId === CUSTOM_ID ? 'is-selected' : ''}
                  onMouseEnter={(event) => showProverbPreview(CUSTOM_ID, event.currentTarget)}
                  onFocus={(event) => showProverbPreview(CUSTOM_ID, event.currentTarget)}
                  onClick={() => {
                    setProverbId(CUSTOM_ID);
                    setProverbMenuOpen(false);
                  }}
                >
                  Write my own text
                </button>
              </div>
            ) : null}
            {proverbMenuOpen && hoveredProverbId ? (
              <div className="bvm-proverb-hover" style={{ top: hoveredProverbTop }} role="tooltip">
                {hoveredProverb ? (
                  <>
                    <strong>{hoveredProverb.reference}</strong>
                    <p>{formatProverbDesignText(hoveredProverb)}</p>
                  </>
                ) : (
                  <>
                    <strong>Write my own text</strong>
                    <p>Type the words you want on the design.</p>
                  </>
                )}
              </div>
            ) : null}
          </div>

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
