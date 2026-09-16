import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CHECKOUT_COUNTRY_OPTIONS } from '../../data/shippingRegions';
import { CountryFlag } from '../ShipToPicker/ShipToPicker';
import './DeliveryFlags.css';

const DEFAULT_CODE = 'US';

const DELIVERY_COUNTRIES = [...CHECKOUT_COUNTRY_OPTIONS].sort((a, b) =>
    a.name.localeCompare(b.name)
);

const DeliveryFlags = () => {
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState(null);
    const wrapRef = useRef(null);
    const menuRef = useRef(null);
    const current = DELIVERY_COUNTRIES.find((option) => option.code === DEFAULT_CODE)
        || DELIVERY_COUNTRIES[0];

    useEffect(() => {
        if (!open) {
            setMenuPos(null);
            return undefined;
        }
        const updatePosition = () => {
            const trigger = wrapRef.current?.querySelector('.delivery-flags-btn');
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

    const toggle = () => {
        if (open) {
            setOpen(false);
            return;
        }
        const trigger = wrapRef.current?.querySelector('.delivery-flags-btn');
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
        <div className="delivery-flags" ref={wrapRef}>
            <button
                type="button"
                className="delivery-flags-btn"
                aria-label={`We deliver to ${DELIVERY_COUNTRIES.map((country) => country.name).join(', ')}`}
                aria-haspopup="listbox"
                aria-expanded={open}
                title="Countries we deliver to"
                onClick={toggle}
            >
                <CountryFlag code={current.code} />
                <svg className="delivery-flags-caret" viewBox="0 0 10 6" aria-hidden="true" focusable="false">
                    <path
                        d="M1 1l4 4 4-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </button>
            {open && menuPos
                ? createPortal(
                    <div className="delivery-flags-menu-layer">
                        <ul
                            ref={menuRef}
                            className="delivery-flags-menu"
                            role="listbox"
                            aria-label="Countries we deliver to"
                            style={{ top: `${menuPos.top}px`, right: `${menuPos.right}px` }}
                        >
                            {DELIVERY_COUNTRIES.map((option) => (
                                <li key={option.code} role="presentation">
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={option.code === DEFAULT_CODE}
                                        className={option.code === DEFAULT_CODE ? 'is-selected' : ''}
                                        onClick={() => setOpen(false)}
                                    >
                                        <CountryFlag code={option.code} />
                                        <span>{option.name}</span>
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

export default DeliveryFlags;
