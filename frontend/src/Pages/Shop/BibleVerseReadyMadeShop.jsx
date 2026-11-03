import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScripturePrintCaption } from '../../Components/ScriptureThumbCaption/ScriptureThumbCaption';
import {
  BIBLE_VERSE_MERCH_SUBDOMAIN,
  BIBLE_VERSE_TEMPLATES,
  KJV_PROVERB_PRESETS,
  applyBibleVerseTemplateSettings,
  formatProverbDesignText,
  recommendedScriptureHighlight,
} from '../../data/bibleVerseMerch';
import {
  BIBLE_VERSE_READY_MADE_DESIGNS,
  BIBLE_VERSE_READY_MADE_SAVED_VERSES,
  BIBLE_VERSE_READY_MADE_STYLE,
  readyMadeDesignSettings,
  readyMadeDisplayText,
  recommendedReadyMadeTextSize,
} from '../../data/bibleVerseReadyMade';
import { fetchStorefrontBibleVerses, mergeBibleVersePresets } from '../../utils/bibleVersesApi';
import { markMerchIntentStarted, savePendingMerchData } from '../../utils/merchSession';
import { fetchPlatformStorefrontDashboard } from '../../utils/platformStorefrontDashboardApi';
import './BibleVerseReadyMadeShop.css';

const DEFAULT_VERSES = [
  ...KJV_PROVERB_PRESETS,
  ...BIBLE_VERSE_READY_MADE_SAVED_VERSES,
];

export default function BibleVerseReadyMadeShop() {
  const navigate = useNavigate();
  const [templateCatalog, setTemplateCatalog] = useState(BIBLE_VERSE_TEMPLATES);
  const [verseCatalog, setVerseCatalog] = useState(DEFAULT_VERSES);
  const [failedTemplateIds, setFailedTemplateIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetchStorefrontBibleVerses(BIBLE_VERSE_MERCH_SUBDOMAIN).then(({ ok, data }) => {
      if (!cancelled && ok) {
        setVerseCatalog(mergeBibleVersePresets(DEFAULT_VERSES, data.verses));
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

  const designs = useMemo(() => {
    const templates = new Map(templateCatalog.map((template) => [template.id, template]));
    const verses = new Map(verseCatalog.map((verse) => [verse.id, verse]));
    return BIBLE_VERSE_READY_MADE_DESIGNS.map((pairing) => {
      const template = templates.get(pairing.templateId);
      const verse = verses.get(pairing.verseId);
      if (!template || !verse || failedTemplateIds.includes(pairing.templateId)) return null;
      const displayText = readyMadeDisplayText(verse);
      const normalizedVerse = { ...verse, text: displayText };
      const settings = readyMadeDesignSettings(pairing, template);
      return {
        ...pairing,
        ...settings,
        template,
        verse: normalizedVerse,
        designText: formatProverbDesignText(normalizedVerse),
        scriptureHighlight: recommendedScriptureHighlight(normalizedVerse),
      };
    }).filter(Boolean);
  }, [failedTemplateIds, templateCatalog, verseCatalog]);

  const selectDesign = (design) => {
    const { template, verse, designText } = design;
    const imageUrl = new URL(template.imageUrl, window.location.origin).toString();
    markMerchIntentStarted();
    savePendingMerchData({
      source: 'image',
      selected_screenshot: imageUrl,
      display_screenshot: template.imageUrl,
      screenshots: [template.imageUrl],
      thumbnail: template.imageUrl,
      videoTitle: `${template.title} — ${verse.reference}`,
      creatorName: 'Bible Verse Merch',
      screenshot_timestamp: '0:00',
      bibleVerseDesign: {
        bibleVerseDesignVersion: 20,
        readyMadeLayoutVersion: 6,
        readyMadeDesignId: design.id,
        imageOpacity: 100,
        textEnabled: design.textEnabled !== false,
        textContent: design.scriptureArtwork
          ? ''
          : (design.scriptureStyle === 'minimal'
            ? (design.scriptureHighlight || designText)
            : designText),
        scriptureReference: design.scriptureArtwork || design.showReference === false ? '' : verse.reference,
        scriptureHighlight: design.scriptureArtwork ? '' : design.scriptureHighlight,
        textColor: design.textColor,
        textSize: design.textSize || recommendedReadyMadeTextSize(designText),
        textOffsetX: design.textOffsetX,
        textOffsetY: design.textOffsetY,
        textDirection: 'horizontal',
        textMaskColor: template.recommendedMaskColor,
        screenshotScale: design.screenshotScale,
        imageOffsetX: design.imageOffsetX,
        imageOffsetY: design.imageOffsetY,
        textPlacement: design.textPlacement,
        textSafeArea: design.textSafeArea,
        selectedProverbId: design.scriptureArtwork ? '' : verse.id,
        selectedProverbTemplateId: template.id,
        homepageFeaturedLayout: false,
        ...BIBLE_VERSE_READY_MADE_STYLE,
        scriptureStyle: design.scriptureStyle,
      },
    });
    navigate('/merchandise');
    window.scrollTo(0, 0);
  };

  return (
    <section className="bvm-ready-shop" aria-labelledby="bvm-ready-title">
      <header className="bvm-ready-heading">
        <p className="bvm-ready-eyebrow">Ready-Made Scripture Collection</p>
        <h2 id="bvm-ready-title">Choose your finished design</h2>
        <p>Select a scripture design, then choose any compatible product.</p>
      </header>

      <div className="bvm-ready-grid">
        {designs.map((design) => {
          const { template, verse, designText } = design;
          const zoomedOut = !design.mirrorPreview && design.screenshotScale < 100;
          const imageShift = design.imageOffsetX
            ? Math.max(0, Math.min(100, 50 + design.imageOffsetX / 2))
            : null;
          const previewZoom = Math.max(0.4, (Number(design.screenshotScale) || 100) / 100);
          const previewX = Math.max(0, Math.min(100, 50 + (Number(design.imageOffsetX) || 0) / 2));
          const previewY = Math.max(0, Math.min(100, 26 + (Number(design.imageOffsetY) || 0) / 2));
          return (
            <article className="bvm-ready-card" key={design.id}>
              <div className={`bvm-ready-art${template.wideArtwork ? ' bvm-ready-art--wide' : ''}`}>
                <img
                  src={template.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={design.mirrorPreview ? {
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: `${previewX}% ${previewY}%`,
                    transform: previewZoom === 1 ? undefined : `scale(${previewZoom})`,
                    transformOrigin: `${previewX}% ${previewY}%`,
                  } : {
                    ...(imageShift != null ? { objectPosition: `${imageShift}% 50%` } : {}),
                    ...(zoomedOut ? {
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: `${design.screenshotScale}%`,
                      height: `${design.screenshotScale}%`,
                      objectFit: 'contain',
                      transform: 'translate(-50%, -50%)',
                    } : {}),
                  }}
                  onError={() => setFailedTemplateIds((current) => (
                    current.includes(template.id) ? current : [...current, template.id]
                  ))}
                />
                {design.scriptureArtwork ? null : (
                  <ScripturePrintCaption
                    text={design.scriptureStyle === 'minimal'
                      ? (design.scriptureHighlight || design.designText)
                      : design.designText}
                    reference={design.showReference ? verse.reference : ''}
                    highlight={design.scriptureHighlight}
                    scriptureStyle={design.scriptureStyle}
                    fontFamily={BIBLE_VERSE_READY_MADE_STYLE.textFont}
                    bold
                    color={design.textColor}
                    size={design.textSize || recommendedReadyMadeTextSize(design.designText)}
                    offsetX={design.textOffsetX}
                    offsetY={design.textOffsetY}
                    safeArea={design.textSafeArea}
                  />
                )}
              </div>
              <div className="bvm-ready-card-copy">
                <h3>{template.title}</h3>
                <p>{verse.reference}</p>
                <button type="button" onClick={() => selectDesign(design)}>
                  Choose This Design
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
