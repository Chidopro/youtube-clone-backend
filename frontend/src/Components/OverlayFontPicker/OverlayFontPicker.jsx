import { useEffect, useRef, useState } from 'react';
import { TEXT_FONT_GROUPS } from '../../utils/overlayFonts';

function fontFamilyStyle(family) {
  const name = String(family || 'Arial').replace(/"/g, '').trim() || 'Arial';
  return `"${name}", sans-serif`;
}

export default function OverlayFontPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = TEXT_FONT_GROUPS
    .flatMap((group) => group.options)
    .find((option) => option.value === value);
  const label = selected?.label || value || 'Arial';

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="tools-font-picker" ref={rootRef}>
      <button
        type="button"
        className="tools-font-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Font"
        style={{ fontFamily: fontFamilyStyle(value) }}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="tools-font-picker-trigger-label">{label}</span>
      </button>
      {open && (
        <div className="tools-font-picker-menu" role="listbox" aria-label="Font">
          {TEXT_FONT_GROUPS.map((group) => (
            <div key={group.label} className="tools-font-picker-group">
              <div className="tools-font-picker-group-label">{group.label}</div>
              {group.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={value === option.value}
                  className={`tools-font-picker-option${value === option.value ? ' is-selected' : ''}`}
                  style={{ fontFamily: fontFamilyStyle(option.value) }}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
