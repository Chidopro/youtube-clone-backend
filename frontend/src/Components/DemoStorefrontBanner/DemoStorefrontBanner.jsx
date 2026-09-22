import React from 'react';
import { createPortal } from 'react-dom';
import './DemoStorefrontBanner.css';

const DemoStorefrontWelcome = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="demo-storefront-welcome-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="demo-storefront-welcome"
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-storefront-welcome-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="demo-storefront-welcome-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 id="demo-storefront-welcome-title">Sample storefront</h2>
        <p>
          This is a sample storefront tour. Sign In opens the dashboard with
          editing turned off.
        </p>
        <div className="demo-storefront-welcome-actions">
          <button type="button" className="demo-storefront-welcome-btn" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DemoStorefrontWelcome;
