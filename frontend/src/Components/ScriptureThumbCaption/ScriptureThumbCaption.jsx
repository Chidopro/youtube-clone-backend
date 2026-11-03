import { useEffect, useRef, useState } from 'react';
import { drawTextMask, overlayTextFontPx } from '../../utils/textMask';
import { overlayFontLoadSpec } from '../../utils/overlayFonts';
import './ScriptureThumbCaption.css';

function verseScale(text) {
  const length = String(text || '').length;
  if (length > 200) return '4.5cqi';
  if (length > 140) return '5.4cqi';
  if (length > 90) return '6.3cqi';
  return '7.4cqi';
}

function isLightColor(color) {
  const hex = String(color || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return true;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

function highlightedVerseParts(text, highlight) {
  const verse = String(text || '');
  const phrase = String(highlight || '').trim();
  if (!phrase) return null;
  const index = verse.toLocaleLowerCase().indexOf(phrase.toLocaleLowerCase());
  if (index < 0) return null;
  let matched = verse.slice(index, index + phrase.length).trim();
  let after = verse.slice(index + phrase.length).trim();
  const punctuation = after.match(/^([,;:.!?]+)/)?.[1] || '';
  if (punctuation) {
    matched += punctuation;
    after = after.slice(punctuation.length).trim();
  }
  return {
    before: verse.slice(0, index).trim(),
    highlight: matched,
    after,
  };
}

export default function ScriptureThumbCaption({
  text = '',
  reference = '',
  highlight = '',
  scriptureStyle = 'classic',
  fontFamily = 'IM FELL English',
  bold = true,
  color = '#fff8e6',
  position = 'center',
  offsetX,
  offsetY,
  mask = 'cream',
  featured = false,
}) {
  const verse = String(text || '').trim();
  const cite = String(reference || '').trim();
  if (!featured && !verse) return null;
  const place = ['top', 'center', 'bottom'].includes(position) ? position : 'center';
  const maskName = mask === 'charcoal' ? 'charcoal' : (mask === 'none' ? 'none' : 'cream');
  const styleName = scriptureStyle === 'highlighted' ? 'highlighted' : (
    scriptureStyle === 'minimal' ? 'minimal' : 'classic'
  );
  const phrase = String(highlight || '').trim();
  const shown = styleName === 'minimal' && phrase ? phrase : verse;
  const parts = styleName === 'highlighted' ? highlightedVerseParts(verse, highlight) : null;
  const pinX = Number(offsetX);
  const pinY = Number(offsetY);
  const pinned = Number.isFinite(pinX) || Number.isFinite(pinY);
  // A shrink-wrapped line with balanced wrapping stacks one word per line.
  // Longer minimal phrases use the same wrap width as the product preview.
  const minimalWidth = shown.length > 26 ? '70%' : 'auto';
  return (
    <div className={`scripture-thumb scripture-thumb--${place} scripture-thumb--${styleName}${
      bold ? ' scripture-thumb--bold' : ''
    }${featured ? ' scripture-thumb--featured' : ''}`}>
      <div
        className={`scripture-thumb-mask scripture-thumb-mask--${maskName}${
          pinned ? ' scripture-thumb-mask--pinned' : ''
        }`}
        style={{
          color,
          fontFamily: `"${String(fontFamily || 'IM FELL English').replace(/"/g, '')}", Georgia, "Times New Roman", serif`,
          textShadow: isLightColor(color)
            ? '0 1px 2px rgba(0, 0, 0, 0.45)'
            : '0 1px 1px rgba(255, 248, 230, 0.35)',
          fontSize: featured ? undefined : verseScale(shown),
          ...(pinned ? {
            position: 'absolute',
            left: `${Number.isFinite(pinX) ? pinX : 50}%`,
            top: `${Number.isFinite(pinY) ? pinY : 50}%`,
            transform: 'translate(-50%, -50%)',
            width: styleName === 'minimal' ? minimalWidth : '84%',
            maxWidth: '88%',
          } : {}),
        }}
      >
        {featured ? (
          <>
            <span className="scripture-thumb-body">Saying with a loud voice,</span>
            <span className="scripture-thumb-highlight">Worthy is the<br />Lamb</span>
            <span className="scripture-thumb-body">
              that was slain to receive power, and riches, and wisdom, and strength,
              and honour, and glory, and blessing.
            </span>
          </>
        ) : parts ? (
          <>
            {parts.before ? <span className="scripture-thumb-body">{parts.before}</span> : null}
            <span className="scripture-thumb-highlight">{parts.highlight}</span>
            {parts.after ? <span className="scripture-thumb-body">{parts.after}</span> : null}
          </>
        ) : (
          <span className="scripture-thumb-verse">{shown}</span>
        )}
        {cite ? <strong>{cite}</strong> : null}
      </div>
    </div>
  );
}

export function ScripturePrintCaption({
  text = '',
  reference = '',
  highlight = '',
  scriptureStyle = 'classic',
  fontFamily = 'Cinzel',
  bold = true,
  color = '#ffffff',
  size = 38,
  offsetX = 50,
  offsetY = 50,
  safeArea,
}) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const verse = String(text || '').trim();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      setBox((current) => (
        current.width === width && current.height === height ? current : { width, height }
      ));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !verse || !(box.width > 0) || !(box.height > 0)) return undefined;
    let cancelled = false;
    const pixelRatio = Math.min(4, Math.max(3, (window.devicePixelRatio || 1) * 2));
    const render = () => {
      if (cancelled || !canvas.isConnected) return;
      canvas.width = Math.max(1, Math.round(box.width * pixelRatio));
      canvas.height = Math.max(1, Math.round(box.height * pixelRatio));
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawTextMask(ctx, {
        text: verse,
        reference,
        scriptureStyle,
        highlight,
        fontFamily,
        fontBold: bold,
        textColor: color,
        fontSize: overlayTextFontPx(size, box.width, box.height) * pixelRatio,
        lineHeight: 1.32,
        safeArea,
        maskEnabled: false,
        maskOpacity: 0,
        offsetX,
        offsetY,
      });
    };
    const redrawWhenFontsArrive = () => {
      if (!cancelled) render();
    };
    render();
    document.fonts?.addEventListener?.('loadingdone', redrawWhenFontsArrive);
    if (document.fonts?.load) {
      const family = fontFamily || 'Cinzel';
      Promise.all([
        document.fonts.load(overlayFontLoadSpec(family, false)),
        document.fonts.load(overlayFontLoadSpec(family, bold)),
      ]).then(redrawWhenFontsArrive).catch(() => {});
    }
    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.('loadingdone', redrawWhenFontsArrive);
    };
  }, [
    bold,
    box.height,
    box.width,
    color,
    fontFamily,
    highlight,
    offsetX,
    offsetY,
    reference,
    safeArea,
    scriptureStyle,
    size,
    verse,
  ]);

  if (!verse) return null;
  return (
    <div ref={hostRef} className="scripture-print-caption" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

export function ScriptureCaptionFromDesign({ design }) {
  const text = String(design?.textContent || '').trim();
  if (!design || design.textEnabled === false || (!design.homepageFeaturedLayout && !text)) return null;
  const featured = Boolean(design.homepageFeaturedLayout);
  if (!featured) {
    return (
      <ScripturePrintCaption
        text={text}
        reference={design.scriptureReference || ''}
        highlight={design.scriptureHighlight || ''}
        scriptureStyle={design.scriptureStyle || 'classic'}
        fontFamily={design.textFont || 'Cinzel'}
        bold={design.textBold !== false}
        color={design.textColor || '#ffffff'}
        size={Number(design.textSize) || 38}
        offsetX={design.textOffsetX}
        offsetY={design.textOffsetY}
        safeArea={design.textSafeArea}
      />
    );
  }
  return (
    <ScriptureThumbCaption
      featured={featured}
      text={text}
      reference={design.scriptureReference || ''}
      highlight={design.scriptureHighlight || ''}
      scriptureStyle={design.scriptureStyle || 'classic'}
      fontFamily={design.textFont || 'IM FELL English'}
      bold={design.textBold !== false}
      color={featured ? '#ffffff' : (design.textColor || '#fff8e6')}
      position={design.textPlacement || 'center'}
      offsetX={featured ? undefined : design.textOffsetX}
      offsetY={featured ? undefined : design.textOffsetY}
      mask={featured || design.textMaskEnabled === false
        ? 'none'
        : (design.textMaskColor || 'cream')}
    />
  );
}
