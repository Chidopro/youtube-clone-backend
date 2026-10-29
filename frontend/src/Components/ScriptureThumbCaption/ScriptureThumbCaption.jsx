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
  const parts = styleName === 'highlighted' ? highlightedVerseParts(verse, highlight) : null;
  return (
    <div className={`scripture-thumb scripture-thumb--${place} scripture-thumb--${styleName}${
      bold ? ' scripture-thumb--bold' : ''
    }${featured ? ' scripture-thumb--featured' : ''}`}>
      <div
        className={`scripture-thumb-mask scripture-thumb-mask--${maskName}`}
        style={{
          color,
          fontFamily: `"${String(fontFamily || 'IM FELL English').replace(/"/g, '')}", Georgia, "Times New Roman", serif`,
          textShadow: isLightColor(color)
            ? '0 1px 2px rgba(0, 0, 0, 0.45)'
            : '0 1px 1px rgba(255, 248, 230, 0.35)',
          fontSize: featured ? undefined : verseScale(verse),
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
          <span className="scripture-thumb-verse">{verse}</span>
        )}
        {cite ? <strong>{cite}</strong> : null}
      </div>
    </div>
  );
}

export function ScriptureCaptionFromDesign({ design }) {
  const text = String(design?.textContent || '').trim();
  if (!design || design.textEnabled === false || (!design.homepageFeaturedLayout && !text)) return null;
  const featured = Boolean(design.homepageFeaturedLayout);
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
      mask={featured || design.textMaskEnabled === false
        ? 'none'
        : (design.textMaskColor || 'cream')}
    />
  );
}
