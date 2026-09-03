import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CHECKOUT_COUNTRY_OPTIONS } from '../../data/shippingRegions';
import {
  SHIP_TO_UPDATED_EVENT,
  getShipToOption,
  readShipToCountry,
  writeShipToCountry,
} from '../../utils/shipToCountry';
import './ShipToPicker.css';

function CountryFlag({ code }) {
  const c = String(code || '').toUpperCase();
  return (
    <svg className="ship-to-flag-svg" viewBox="0 0 20 14" aria-hidden="true" focusable="false">
      {c === 'CA' ? (
        <>
          <rect width="20" height="14" fill="#fff" />
          <rect width="5" height="14" fill="#d52b1e" />
          <rect x="15" width="5" height="14" fill="#d52b1e" />
          <path fill="#d52b1e" d="M10 2.2l.7 2.1h2.2l-1.8 1.3.7 2.1L10 6.4 8.2 7.7l.7-2.1-1.8-1.3h2.2z" />
        </>
      ) : c === 'GB' ? (
        <>
          <rect width="20" height="14" fill="#012169" />
          <path stroke="#fff" strokeWidth="2.6" d="M0 0l20 14M20 0L0 14" />
          <path stroke="#c8102e" strokeWidth="1.2" d="M0 0l20 14M20 0L0 14" />
          <path stroke="#fff" strokeWidth="3.4" d="M10 0v14M0 7h20" />
          <path stroke="#c8102e" strokeWidth="2" d="M10 0v14M0 7h20" />
        </>
      ) : c === 'IE' ? (
        <>
          <rect width="6.67" height="14" fill="#169b62" />
          <rect x="6.67" width="6.66" height="14" fill="#fff" />
          <rect x="13.33" width="6.67" height="14" fill="#ff883e" />
        </>
      ) : c === 'AU' ? (
        <>
          <rect width="20" height="14" fill="#012169" />
          <rect width="9" height="7" fill="#012169" />
          <path stroke="#fff" strokeWidth="1.1" d="M0 0l9 7M9 0L0 7" />
          <path stroke="#c8102e" strokeWidth="0.5" d="M0 0l9 7M9 0L0 7" />
          <path stroke="#fff" strokeWidth="1.6" d="M4.5 0v7M0 3.5h9" />
          <path stroke="#c8102e" strokeWidth="0.9" d="M4.5 0v7M0 3.5h9" />
          <path fill="#fff" d="M14.4 9.6l.35 1.05h1.1l-.9.65.35 1.05-.9-.65-.9.65.35-1.05-.9-.65h1.1z" />
          <path fill="#fff" d="M12.2 4.1l.25.75h.8l-.65.47.25.75-.65-.47-.65.47.25-.75-.65-.47h.8z" />
          <path fill="#fff" d="M16.6 5.2l.2.6h.65l-.52.38.2.6-.53-.38-.52.38.2-.6-.53-.38h.65z" />
        </>
      ) : c === 'DE' ? (
        <>
          <rect width="20" height="14" fill="#000" />
          <rect y="4.67" width="20" height="4.66" fill="#dd0000" />
          <rect y="9.33" width="20" height="4.67" fill="#ffce00" />
        </>
      ) : (
        <>
          <rect width="20" height="14" fill="#bf0a30" />
          <rect y="1.08" width="20" height="1.08" fill="#fff" />
          <rect y="3.23" width="20" height="1.08" fill="#fff" />
          <rect y="5.38" width="20" height="1.08" fill="#fff" />
          <rect y="7.54" width="20" height="1.08" fill="#fff" />
          <rect y="9.69" width="20" height="1.08" fill="#fff" />
          <rect y="11.85" width="20" height="1.08" fill="#fff" />
          <rect width="8.2" height="7.5" fill="#002868" />
        </>
      )}
    </svg>
  );
}

const ShipToPicker = () => {
  const [code, setCode] = useState(readShipToCountry);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);
  const current = getShipToOption(code);

  useEffect(() => {
    const sync = () => setCode(readShipToCountry());
    window.addEventListener(SHIP_TO_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SHIP_TO_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return undefined;
    }
    const updatePosition = () => {
      const trigger = wrapRef.current?.querySelector('.ship-to-picker-btn');
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 6,
        right: Math.max(10, window.innerWidth - rect.right),
      });
    };
    const onDoc = (event) => {
      const inTrigger = wrapRef.current && wrapRef.current.contains(event.target);
      const inMenu = menuRef.current && menuRef.current.contains(event.target);
      if (!inTrigger && !inMenu) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    updatePosition();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const select = (next) => {
    writeShipToCountry(next);
    setCode(next);
    setOpen(false);
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const trigger = wrapRef.current?.querySelector('.ship-to-picker-btn');
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 6,
        right: Math.max(10, window.innerWidth - rect.right),
      });
    }
    setOpen(true);
  };

  return (
    <div className="ship-to-picker" ref={wrapRef}>
      <button
        type="button"
        className="ship-to-picker-btn"
        aria-label={`Ship to ${current.name}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`Ship to ${current.name}`}
        onClick={toggle}
      >
        <CountryFlag code={current.code} />
      </button>
      {open && menuPos
        ? createPortal(
            <div className="ship-to-menu-layer">
              <ul
                ref={menuRef}
                className="ship-to-menu ship-to-menu--portal"
                role="listbox"
                aria-label="Ship to country"
                style={{ top: `${menuPos.top}px`, right: `${menuPos.right}px` }}
              >
                {CHECKOUT_COUNTRY_OPTIONS.map((opt) => (
                  <li key={opt.code} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={opt.code === current.code}
                      className={opt.code === current.code ? 'is-selected' : ''}
                      onClick={() => select(opt.code)}
                    >
                      <CountryFlag code={opt.code} />
                      <span>{opt.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export default ShipToPicker;
