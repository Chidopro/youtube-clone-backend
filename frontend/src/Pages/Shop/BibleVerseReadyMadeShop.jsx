import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScriptureThumbCaption from '../../Components/ScriptureThumbCaption/ScriptureThumbCaption';
import {
  BIBLE_VERSE_MERCH_SUBDOMAIN,
  BIBLE_VERSE_TEMPLATES,
  KJV_PROVERB_PRESETS,
  applyBibleVerseTemplateSettings,
  formatProverbDesignText,
  recommendedScriptureHighlight,
  textPositionDefaults,
} from '../../data/bibleVerseMerch';
import {
  BIBLE_VERSE_READY_MADE_DESIGNS,
  BIBLE_VERSE_READY_MADE_SAVED_VERSES,
  BIBLE_VERSE_READY_MADE_STYLE,
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
      return {
        ...pairing,
        template,
        verse: normalizedVerse,
        designText: formatProverbDesignText(normalizedVerse),
      };
    }).filter(Boolean);
  }, [failedTemplateIds, templateCatalog, verseCatalog]);

  const selectDesign = (design) => {
    const { template, verse, designText } = design;
    const placement = textPositionDefaults(template.recommendedTextPosition);
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
        readyMadeDesignId: design.id,
        imageOpacity: 100,
        textEnabled: true,
        textContent: designText,
        scriptureReference: verse.reference,
        scriptureHighlight: recommendedScriptureHighlight(verse),
        textColor: template.recommendedTextColor,
        textSize: recommendedReadyMadeTextSize(designText),
        textOffsetX: placement.offsetX,
        textOffsetY: placement.offsetY,
        textDirection: 'horizontal',
        textMaskColor: template.recommendedMaskColor,
        screenshotScale: 150,
        textPlacement: placement.position,
        textSafeArea: template.recommendedTextSafeArea,
        selectedProverbId: verse.id,
        selectedProverbTemplateId: template.id,
        homepageFeaturedLayout: false,
        ...BIBLE_VERSE_READY_MADE_STYLE,
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
          return (
            <article className="bvm-ready-card" key={design.id}>
              <div className="bvm-ready-art">
                <img
                  src={template.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => setFailedTemplateIds((current) => (
                    current.includes(template.id) ? current : [...current, template.id]
                  ))}
                />
                <ScriptureThumbCaption
                  text={designText}
                  reference={verse.reference}
                  highlight={recommendedScriptureHighlight(verse)}
                  scriptureStyle="highlighted"
                  fontFamily="IM FELL English"
                  bold
                  color={template.recommendedTextColor}
                  position={template.recommendedTextPosition}
                  mask="none"
                />
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
