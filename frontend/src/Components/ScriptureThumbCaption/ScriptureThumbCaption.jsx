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

export default function ScriptureThumbCaption({
  text = '',
  reference = '',
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
  return (
    <div className={`scripture-thumb scripture-thumb--${place}${featured ? ' scripture-thumb--featured' : ''}`}>
      <div
        className={`scripture-thumb-mask scripture-thumb-mask--${maskName}`}
        style={{
          color,
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
      color={featured ? '#ffffff' : (design.textColor || '#fff8e6')}
      position={design.textPlacement || 'center'}
      mask={featured ? 'none' : (design.textMaskColor || 'cream')}
    />
  );
}
